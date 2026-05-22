"""
ClientFactory — creates exchange clients appropriate for the current TradingMode.

SAFETY CONTRACT:
  - In PAPER mode, the factory ASSERTS that config.is_paper before every client
    construction, and returns only public/read-only clients.
  - In LIVE mode, the factory requires config.credentials to be non-None and
    validates each credential field again before passing it to the live client.
  - Double-assertion guards prevent a misconfigured config object from silently
    initialising a live client.
"""

import logging
from dataclasses import dataclass

from config import Config, TradingMode
from clients.bybit_client import PaperBybitClient, LiveBybitClient
from clients.polymarket_client import PaperPolymarketClient, LivePolymarketClient

log = logging.getLogger(__name__)


# ── Result container ──────────────────────────────────────────────────────────

@dataclass
class TradingClients:
    bybit:      PaperBybitClient | LiveBybitClient
    polymarket: PaperPolymarketClient | LivePolymarketClient
    mode:       TradingMode


# ── Factory ───────────────────────────────────────────────────────────────────

class ClientFactory:
    """Async factory — call `await ClientFactory.create(config)` to get clients."""

    @staticmethod
    async def create(config: Config) -> TradingClients:
        if config.is_paper:
            return await ClientFactory._create_paper(config)
        elif config.is_live:
            return await ClientFactory._create_live(config)
        else:
            raise ValueError(f"Unknown TradingMode: {config.mode}")

    # ── Paper path ────────────────────────────────────────────────────────────

    @staticmethod
    async def _create_paper(config: Config) -> TradingClients:
        # Double-assert: mode must be PAPER AND credentials must be absent
        assert config.is_paper, "BUG: _create_paper called with non-PAPER config"
        assert config.credentials is None, (
            "BUG: PAPER config must not carry live credentials"
        )

        log.info("ClientFactory: building PAPER clients (public endpoints only)")

        bybit      = PaperBybitClient()
        polymarket = PaperPolymarketClient()

        log.info(
            "ClientFactory: PAPER clients ready — "
            "no private keys loaded, no write access possible"
        )
        return TradingClients(bybit=bybit, polymarket=polymarket, mode=TradingMode.PAPER)

    # ── Live path ─────────────────────────────────────────────────────────────

    @staticmethod
    async def _create_live(config: Config) -> TradingClients:
        # Triple-assert: mode must be LIVE, credentials must be present,
        # and each required credential must be non-empty
        assert config.is_live, "BUG: _create_live called with non-LIVE config"
        assert config.credentials is not None, (
            "BUG: LIVE config must carry LiveCredentials"
        )
        creds = config.credentials
        assert creds.bybit_api_key,          "BUG: bybit_api_key is empty"
        assert creds.bybit_api_secret,       "BUG: bybit_api_secret is empty"
        assert creds.polymarket_private_key, "BUG: polymarket_private_key is empty"

        log.warning(
            "ClientFactory: building LIVE clients — "
            "real funds at risk, orders will execute on mainnet"
        )

        bybit = LiveBybitClient(
            api_key=creds.bybit_api_key,
            api_secret=creds.bybit_api_secret,
            testnet=config.bybit_testnet,
        )

        polymarket = LivePolymarketClient(
            private_key=creds.polymarket_private_key,
            chain_id=config.polymarket_chain_id,
            api_key=creds.polymarket_api_key,
            api_secret=creds.polymarket_api_secret,
            api_passphrase=creds.polymarket_api_passphrase,
        )

        log.warning("ClientFactory: LIVE clients ready — exchange connections active")
        return TradingClients(bybit=bybit, polymarket=polymarket, mode=TradingMode.LIVE)
