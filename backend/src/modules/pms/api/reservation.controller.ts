import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('pms')
@Controller({ path: 'reservations', version: '1' })
export class ReservationController {}
