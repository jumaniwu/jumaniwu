import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import {
  ReservationService,
  CreateReservationDto,
  CancelReservationDto,
} from '../application/reservation.service';
import { CheckInService, CheckInDto } from '../application/check-in.service';
import { CheckOutService, CheckOutDto } from '../application/check-out.service';
import { ReservationStatus } from '../domain/reservation/reservation.entity';
import { Roles } from '@shared/kernel/auth/roles.decorator';

@ApiTags('PMS — Reservations')
@ApiBearerAuth()
@Controller({ path: 'reservations', version: '1' })
export class ReservationController {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly checkInService: CheckInService,
    private readonly checkOutService: CheckOutService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new reservation' })
  @Roles('FRONT_DESK', 'MANAGER', 'HOTEL_ADMIN')
  create(@Body() dto: CreateReservationDto) {
    return this.reservationService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List reservations with optional filters' })
  @ApiQuery({ name: 'status', enum: ReservationStatus, required: false })
  @ApiQuery({ name: 'arrivalDate', required: false, example: '2025-12-01' })
  @ApiQuery({ name: 'guestId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('status') status?: ReservationStatus,
    @Query('arrivalDate') arrivalDate?: string,
    @Query('guestId') guestId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reservationService.findAll({
      status,
      arrivalDate,
      guestId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reservation by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationService.findById(id);
  }

  @Get('confirmation/:confirmationNo')
  @ApiOperation({ summary: 'Look up reservation by confirmation number' })
  findByConfirmationNo(@Param('confirmationNo') confirmationNo: string) {
    return this.reservationService.findByConfirmationNo(confirmationNo);
  }

  @Get(':id/rooms')
  @ApiOperation({ summary: 'Get rooms assigned to a reservation' })
  getRooms(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationService.getReservationRooms(id);
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm a tentative reservation' })
  @Roles('FRONT_DESK', 'MANAGER', 'HOTEL_ADMIN')
  confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationService.confirm(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a reservation' })
  @Roles('FRONT_DESK', 'MANAGER', 'HOTEL_ADMIN')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelReservationDto) {
    return this.reservationService.cancel(id, dto);
  }

  @Post('check-in')
  @ApiOperation({ summary: 'Check in a reservation — assign rooms and open master folio' })
  @Roles('FRONT_DESK', 'MANAGER', 'HOTEL_ADMIN')
  checkIn(@Body() dto: CheckInDto) {
    return this.checkInService.checkIn(dto);
  }

  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check out a reservation — settle folio and release rooms' })
  @Roles('FRONT_DESK', 'CASHIER', 'MANAGER', 'HOTEL_ADMIN')
  checkOut(@Body() dto: CheckOutDto) {
    return this.checkOutService.checkOut(dto);
  }
}
