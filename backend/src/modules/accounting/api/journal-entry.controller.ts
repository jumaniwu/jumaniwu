import { Controller, Get, Post, Param, Body, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JournalEntryService, CreateJournalEntryDto } from '../application/journal-entry.service';
import { Roles } from '@shared/kernel/auth/roles.decorator';

@ApiTags('Accounting — Journal Entries')
@ApiBearerAuth()
@Controller({ path: 'journal-entries', version: '1' })
export class JournalEntryController {
  constructor(private readonly journalEntryService: JournalEntryService) {}

  @Post()
  @ApiOperation({ summary: 'Create and post a manual journal entry' })
  @Roles('ACCOUNTING', 'HOTEL_ADMIN')
  create(@Body() dto: CreateJournalEntryDto) { return this.journalEntryService.createAndPost(dto); }

  @Get('by-source/:sourceEntityId')
  @ApiOperation({ summary: 'Get all journal entries for a source entity (folio, PO, etc.)' })
  @Roles('ACCOUNTING', 'AUDITOR', 'MANAGER', 'HOTEL_ADMIN')
  findBySource(@Param('sourceEntityId', ParseUUIDPipe) sourceEntityId: string) {
    return this.journalEntryService.findBySourceEntity(sourceEntityId);
  }

  @Post(':id/reverse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reverse a posted journal entry (immutable audit trail)' })
  @Roles('ACCOUNTING', 'HOTEL_ADMIN')
  reverse(@Param('id', ParseUUIDPipe) id: string, @Body() body: { reason: string }) {
    return this.journalEntryService.reverseEntry(id, body.reason);
  }
}
