import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { SendBatchDto } from './dto/send-batch.dto';
import { SendSingleDto } from './dto/send-single.dto';
import { SendTestEmailDto } from './dto/send-test-email.dto';
import { TestGeminiDto } from './dto/test-gemini.dto';
import { MailingService } from './mailing.service';

@Controller('mailing')
export class MailingController {
  constructor(private readonly mailingService: MailingService) {}

  @Post('send-initial')
  @HttpCode(HttpStatus.OK)
  sendInitialBatch(
    @Body() sendBatchDto: SendBatchDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.mailingService.sendInitialBatch(
      sendBatchDto.companyIds,
      user?.id,
    );
  }

  @Post('send-single/:id')
  @HttpCode(HttpStatus.OK)
  sendSingle(
    @Param('id') id: string,
    @Body() sendSingleDto: SendSingleDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.mailingService.sendSingle(
      id,
      sendSingleDto.subject,
      sendSingleDto.body,
      user?.id,
    );
  }

  @Post('send-follow-up/:id')
  @HttpCode(HttpStatus.OK)
  sendFollowUp(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.mailingService.sendFollowUp(id, user?.id);
  }

  @Post('check-replies')
  @HttpCode(HttpStatus.OK)
  checkReplies() {
    return this.mailingService.checkIncomingReplies();
  }

  @Post('test-gemini')
  @HttpCode(HttpStatus.OK)
  testGemini(
    @Body() testDto: TestGeminiDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.mailingService.testGemini(
      testDto.companyName,
      testDto.nature,
      user?.id,
    );
  }

  @Post('send-test')
  @HttpCode(HttpStatus.OK)
  sendTestEmail(
    @Body() testDto: SendTestEmailDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.mailingService.sendTestEmail(
      testDto.toEmail,
      testDto.companyName,
      testDto.subject,
      testDto.body,
      user ?? undefined,
    );
  }
}
