import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Get('status')
  getStatus() {
    return this.schedulerService.getSchedulerOverview();
  }

  @Post('trigger-transitions')
  @HttpCode(HttpStatus.OK)
  triggerTransitions() {
    return this.schedulerService.runStateMachineTransitions();
  }

  @Post('trigger-imap')
  @HttpCode(HttpStatus.OK)
  triggerImap() {
    return this.schedulerService.handlePeriodicImapCheck();
  }
}
