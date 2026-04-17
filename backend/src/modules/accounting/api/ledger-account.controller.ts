import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('accounting')
@Controller({ path: 'ledger-accounts', version: '1' })
export class LedgerAccountController {}
