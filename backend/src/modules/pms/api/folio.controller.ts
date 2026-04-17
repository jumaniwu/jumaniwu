import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('pms')
@Controller({ path: 'folios', version: '1' })
export class FolioController {}
