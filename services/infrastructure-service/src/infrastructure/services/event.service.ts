import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { EventRepository } from '../repositories/event.repository';
import { CreateEventDto } from '../dto/create-event.dto';
import { Event } from '../entities/event.entity';

@Injectable()
export class EventService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly eventRepository: EventRepository,
  ) {}

  async createEvent(createEventDto: CreateEventDto): Promise<Event> {
    try {
      const event = await this.eventRepository.createEvent(createEventDto);

      this.logger.log(
        `Event created: ${createEventDto.eventType} (ID: ${event.id})`,
        'EventService',
      );

      return event;
    } catch (error) {
      this.logger.error(
        `Failed to create event: ${error.message}`,
        error.stack,
        'EventService',
      );
      throw error;
    }
  }

  async getAllEvents(
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ data: Event[]; total: number }> {
    try {
      const [data, total] = await Promise.all([
        this.eventRepository.getAllEvents(limit, offset),
        this.eventRepository.getEventsCount(),
      ]);

      this.logger.log(
        `Retrieved ${data.length} events`,
        'EventService',
      );

      return { data, total };
    } catch (error) {
      this.logger.error(
        `Failed to get events: ${error.message}`,
        error.stack,
        'EventService',
      );
      throw error;
    }
  }

  async getEventById(id: string): Promise<Event | null> {
    try {
      const event = await this.eventRepository.getEventById(id);

      this.logger.log(
        `Retrieved event by ID: ${id}`,
        'EventService',
      );

      return event;
    } catch (error) {
      this.logger.error(
        `Failed to get event by ID: ${error.message}`,
        error.stack,
        'EventService',
      );
      throw error;
    }
  }

  async getEventsByType(
    eventType: string,
    limit: number = 100,
  ): Promise<Event[]> {
    try {
      const events = await this.eventRepository.getEventsByType(eventType, limit);

      this.logger.log(
        `Retrieved ${events.length} events of type: ${eventType}`,
        'EventService',
      );

      return events;
    } catch (error) {
      this.logger.error(
        `Failed to get events by type: ${error.message}`,
        error.stack,
        'EventService',
      );
      throw error;
    }
  }
}
