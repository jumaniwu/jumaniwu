import { Controller, Get, Post, Patch, Delete, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LedgerAccountService, CreateLedgerAccountDto } from '../application/ledger-account.service';
import { AccountType } from '../domain/ledger-account.entity';
import { Roles } from '@shared/kernel/auth/roles.decorator';

@ApiTags('Accounting — Chart of Accounts')
@ApiBearerAuth()
@Controller({ path: 'ledger-accounts', version: '1' })
export class LedgerAccountController {
  constructor(private readonly ledgerAccountService: LedgerAccountService) {}

  @Post()
  @ApiOperation({ summary: 'Create a ledger account' })
  @Roles('ACCOUNTING', 'HOTEL_ADMIN')
  create(@Body() dto: CreateLedgerAccountDto) { return this.ledgerAccountService.create(dto); }

  @Get()
  @ApiOperation({ summary: 'List ledger accounts (flat, optionally filtered by type)' })
  findAll(@Query('accountType') accountType?: AccountType) { return this.ledgerAccountService.findAll(accountType); }

  @Get('tree')
  @ApiOperation({ summary: 'Get full Chart of Accounts as a nested tree' })
  getTree() { return this.ledgerAccountService.getCoaTree(); }

  @Get('code/:code')
  @ApiOperation({ summary: 'Find account by code' })
  findByCode(@Param('code') code: string) { return this.ledgerAccountService.findByCode(code); }

  @Get(':id')
  @ApiOperation({ summary: 'Get ledger account by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.ledgerAccountService.findById(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ledger account' })
  @Roles('ACCOUNTING', 'HOTEL_ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateLedgerAccountDto>) {
    return this.ledgerAccountService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a ledger account' })
  @Roles('ACCOUNTING', 'HOTEL_ADMIN')
  deactivate(@Param('id', ParseUUIDPipe) id: string) { return this.ledgerAccountService.deactivate(id); }
}
