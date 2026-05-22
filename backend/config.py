"""
Trading mode configuration and credential management.

PAPER mode: connects ONLY to public, read-only endpoints. Private keys are
             scrubbed from the process environment so they cannot leak into
             third-party libraries.
LIVE mode:  decrypts and loads private credentials, initialises Web3 wallet,
             and enables real order placement on Bybit + Polymarket.
"""

import os
import re
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

log = logging.getLogger(__name__)

# ── Private environment keys scrubbed in PAPER mode ──────────────────────────

_PRIVATE_ENV_KEYS = frozenset({
    "BYBIT_API_KEY",
    "BYBIT_API_SECRET",
    "POLYMARKET_PRIVATE_KEY",
    "POLYMARKET_API_KEY",
    "POLYMARKET_API_SECRET",
    "POLYMARKET_API_PASSPHRASE",
})

# ── Regex validators ──────────────────────────────────────────────────────────

_RE_EVM_PRIVKEY = re.compile(r"^(0x)?[0-9a-fA-F]{64}$")
_RE_BYBIT_APIKEY = re.compile(r"^[A-Za-z0-9]{18,36}$")


# ── Enums ─────────────────────────────────────────────────────────────────────

class TradingMode(str, Enum):
    PAPER = "PAPER"
    LIVE  = "LIVE"


# ── Credential dataclass (LIVE only) ─────────────────────────────────────────

@dataclass(frozen=True)
class LiveCredentials:
    bybit_api_key:           str
    bybit_api_secret:        str
    polymarket_private_key:  str   # EVM private key (0x-prefixed hex)
    # Optional Polymarket CLOB API creds (L2 auth)
    polymarket_api_key:      str = ""
    polymarket_api_secret:   str = ""
    polymarket_api_passphrase: str = ""


# ── Config dataclass ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Config:
    mode:        TradingMode
    credentials: Optional[LiveCredentials]  # None when mode == PAPER
    bybit_testnet: bool = False
    polymarket_chain_id: int = 137  # Polygon mainnet

    # ── Factory ───────────────────────────────────────────────────────────────

    @classmethod
    def from_env(cls) -> "Config":
        raw_mode = os.environ.get("TRADING_MODE", "PAPER").strip().upper()
        try:
            mode = TradingMode(raw_mode)
        except ValueError:
            raise ValueError(
                f"Invalid TRADING_MODE='{raw_mode}'. Must be 'PAPER' or 'LIVE'."
            )

        if mode is TradingMode.PAPER:
            _scrub_private_env()
            log.info(
                "TRADING_MODE=PAPER — private credentials scrubbed from environment. "
                "Only public, read-only endpoints will be used."
            )
            return cls(mode=mode, credentials=None)

        # LIVE path — load and validate credentials
        log.warning(
            "TRADING_MODE=LIVE — real order placement enabled. "
            "Ensure this is intentional before proceeding."
        )
        creds = _load_and_validate_live_credentials()
        return cls(
            mode=mode,
            credentials=creds,
            bybit_testnet=os.environ.get("BYBIT_TESTNET", "false").lower() == "true",
            polymarket_chain_id=int(os.environ.get("POLYMARKET_CHAIN_ID", "137")),
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    @property
    def is_paper(self) -> bool:
        return self.mode is TradingMode.PAPER

    @property
    def is_live(self) -> bool:
        return self.mode is TradingMode.LIVE


# ── Internal helpers ──────────────────────────────────────────────────────────

def _scrub_private_env() -> None:
    """Remove private credential environment variables from the current process."""
    removed = []
    for key in _PRIVATE_ENV_KEYS:
        if key in os.environ:
            del os.environ[key]
            removed.append(key)
    if removed:
        log.info("PAPER mode — scrubbed env vars: %s", ", ".join(sorted(removed)))


def _load_and_validate_live_credentials() -> LiveCredentials:
    """Load and validate all required live credentials from the environment."""

    def _require(key: str) -> str:
        val = os.environ.get(key, "").strip()
        if not val:
            raise EnvironmentError(
                f"TRADING_MODE=LIVE requires '{key}' to be set in the environment."
            )
        return val

    bybit_api_key    = _require("BYBIT_API_KEY")
    bybit_api_secret = _require("BYBIT_API_SECRET")
    poly_privkey     = _require("POLYMARKET_PRIVATE_KEY")

    # Format validation — reject obviously malformed keys before any network call
    if not _RE_BYBIT_APIKEY.match(bybit_api_key):
        raise ValueError(
            "BYBIT_API_KEY format invalid. Expected 18-36 alphanumeric characters."
        )
    if not _RE_EVM_PRIVKEY.match(poly_privkey):
        raise ValueError(
            "POLYMARKET_PRIVATE_KEY format invalid. "
            "Expected a 64-hex-char EVM private key (optional 0x prefix)."
        )

    # Normalise EVM key to 0x-prefixed lowercase
    if not poly_privkey.startswith("0x"):
        poly_privkey = "0x" + poly_privkey
    poly_privkey = poly_privkey.lower()

    log.info("Live credentials loaded and validated (keys not logged).")

    return LiveCredentials(
        bybit_api_key=bybit_api_key,
        bybit_api_secret=bybit_api_secret,
        polymarket_private_key=poly_privkey,
        polymarket_api_key=os.environ.get("POLYMARKET_API_KEY", ""),
        polymarket_api_secret=os.environ.get("POLYMARKET_API_SECRET", ""),
        polymarket_api_passphrase=os.environ.get("POLYMARKET_API_PASSPHRASE", ""),
    )
