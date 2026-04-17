import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('pos')
@Controller({ path: 'pos-outlets', version: '1' })
export class PosOutletController {}
