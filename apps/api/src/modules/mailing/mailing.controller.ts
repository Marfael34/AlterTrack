import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { SendBatchDto } from './dto/send-batch.dto';
import { TestGeminiDto } from './dto/test-gemini.dto';
import { MailingService } from './mailing.service';

@Controller('mailing')
export class MailingController {
  constructor(private readonly mailingService: MailingService) {}

  @Post('send-initial')
  @HttpCode(HttpStatus.OK)
  sendInitialBatch(@Body() sendBatchDto: SendBatchDto) {
    return this.mailingService.sendInitialBatch(sendBatchDto.companyIds);
  }

  @Post('send-follow-up/:id')
  @HttpCode(HttpStatus.OK)
  sendFollowUp(@Param('id') id: string) {
    return this.mailingService.sendFollowUp(id);
  }

  @Post('check-replies')
  @HttpCode(HttpStatus.OK)
  checkReplies() {
    return this.mailingService.checkIncomingReplies();
  }

  @Post('test-gemini')
  @HttpCode(HttpStatus.OK)
  testGemini(@Body() testDto: TestGeminiDto) {
    return this.mailingService.testGemini(testDto.companyName, testDto.nature);
  }
}
