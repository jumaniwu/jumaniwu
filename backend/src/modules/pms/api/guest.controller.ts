import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('pms')
@Controller({ path: 'guests', version: '1' })
export class GuestController {}
