import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('cms')
@Controller({ path: 'channels', version: '1' })
export class ChannelController {}
