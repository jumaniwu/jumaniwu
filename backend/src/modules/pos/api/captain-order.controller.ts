import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('pos')
@Controller({ path: 'captain-orders', version: '1' })
export class CaptainOrderController {}
