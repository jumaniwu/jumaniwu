import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('accounting')
@Controller({ path: 'journal-entries', version: '1' })
export class JournalEntryController {}
