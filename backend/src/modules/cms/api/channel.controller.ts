import { Controller, Get, Post, Patch, Delete, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChannelService, CreateChannelDto } from '../application/channel.service';
import { Roles } from '@shared/kernel/auth/roles.decorator';

@ApiTags('CMS — Channels')
@ApiBearerAuth()
@Controller({ path: 'channels', version: '1' })
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  @Post()
  @ApiOperation({ summary: 'Create a distribution channel' })
  @Roles('MANAGER', 'HOTEL_ADMIN')
  create(@Body() dto: CreateChannelDto) { return this.channelService.create(dto); }

  @Get()
  @ApiOperation({ summary: 'List all channels' })
  findAll() { return this.channelService.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get channel by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.channelService.findById(id); }

  @Patch(':id/sync-status')
  @ApiOperation({ summary: 'Update channel sync/connection status' })
  @Roles('MANAGER', 'HOTEL_ADMIN')
  updateSyncStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { syncStatus: string },
  ) { return this.channelService.updateSyncStatus(id, body.syncStatus); }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a channel' })
  @Roles('MANAGER', 'HOTEL_ADMIN')
  deactivate(@Param('id', ParseUUIDPipe) id: string) { return this.channelService.deactivate(id); }
}
