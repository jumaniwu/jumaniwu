import { Controller, Get, Post, Delete, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PosOutletService, CreateOutletDto } from '../application/pos-outlet.service';
import { Roles } from '@shared/kernel/auth/roles.decorator';

@ApiTags('POS — Outlets')
@ApiBearerAuth()
@Controller({ path: 'pos-outlets', version: '1' })
export class PosOutletController {
  constructor(private readonly posOutletService: PosOutletService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new POS outlet' })
  @Roles('MANAGER', 'HOTEL_ADMIN')
  create(@Body() dto: CreateOutletDto) { return this.posOutletService.create(dto); }

  @Get()
  @ApiOperation({ summary: 'List all active outlets' })
  findAll() { return this.posOutletService.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get outlet by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.posOutletService.findById(id); }

  @Get(':id/menu')
  @ApiOperation({ summary: 'Get full menu for an outlet (grouped by category)' })
  getMenu(@Param('id', ParseUUIDPipe) id: string) { return this.posOutletService.getMenuItems(id); }
}
