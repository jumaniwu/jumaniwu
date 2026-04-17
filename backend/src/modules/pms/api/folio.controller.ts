import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  FolioService,
  PostChargeDto,
  PostPaymentDto,
  TransferItemsDto,
  VoidItemDto,
  OpenDeskFolioDto,
} from '../application/folio.service';
import { Roles } from '@shared/kernel/auth/roles.decorator';

@ApiTags('PMS — Folios')
@ApiBearerAuth()
@Controller({ path: 'folios', version: '1' })
export class FolioController {
  constructor(private readonly folioService: FolioService) {}

  @Get('by-reservation/:reservationId')
  @ApiOperation({ summary: 'Get all folios for a reservation' })
  getByReservation(@Param('reservationId', ParseUUIDPipe) reservationId: string) {
    return this.folioService.getFoliosByReservation(reservationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get folio with all line items' })
  getWithItems(@Param('id', ParseUUIDPipe) id: string) {
    return this.folioService.getFolioWithItems(id);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Get current folio balance' })
  getBalance(@Param('id', ParseUUIDPipe) id: string) {
    return this.folioService.getFolioBalance(id).then((balance) => ({ balance }));
  }

  @Post('desk')
  @ApiOperation({ summary: 'Open a new Desk Folio linked to a Master Folio' })
  @Roles('FRONT_DESK', 'CASHIER', 'MANAGER', 'HOTEL_ADMIN')
  openDeskFolio(@Body() dto: OpenDeskFolioDto) {
    return this.folioService.openDeskFolio(dto);
  }

  @Post(':id/charges')
  @ApiOperation({ summary: 'Post a charge to a folio' })
  @Roles('FRONT_DESK', 'CASHIER', 'NIGHT_AUDIT', 'MANAGER', 'HOTEL_ADMIN')
  postCharge(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PostChargeDto) {
    return this.folioService.postCharge({ ...dto, folioId: id });
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Post a payment to a folio' })
  @Roles('FRONT_DESK', 'CASHIER', 'MANAGER', 'HOTEL_ADMIN')
  postPayment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PostPaymentDto) {
    return this.folioService.postPayment({ ...dto, folioId: id });
  }

  @Patch(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a folio' })
  @Roles('FRONT_DESK', 'CASHIER', 'NIGHT_AUDIT', 'MANAGER', 'HOTEL_ADMIN')
  closeFolio(@Param('id', ParseUUIDPipe) id: string) {
    return this.folioService.closeFolio(id);
  }

  @Patch('items/:itemId/void')
  @ApiOperation({ summary: 'Void a folio line item' })
  @Roles('MANAGER', 'HOTEL_ADMIN')
  voidItem(@Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: VoidItemDto) {
    return this.folioService.voidItem(itemId, dto);
  }

  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer items between folios' })
  @Roles('FRONT_DESK', 'CASHIER', 'MANAGER', 'HOTEL_ADMIN')
  transferItems(@Body() dto: TransferItemsDto) {
    return this.folioService.transferItems(dto);
  }
}
