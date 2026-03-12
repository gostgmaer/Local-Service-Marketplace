import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { Event } from '../entities/event.entity';
import { CreateEventDto } from '../dto/create-event.dto';

@Injectable()
export class EventRepository {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async createEvent(createEventDto: CreateEventDto): Promise<Event> {
    const query = `
      INSERT INTO events (event_type, payload)
      VALUES ($1, $2)
      RETURNING id, event_type as "eventType", payload, created_at as "createdAt"
    `;

    const values = [
      createEventDto.eventType,
      createEventDto.payload || null,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getAllEvents(
    limit: number = 100,
    offset: number = 0,
  ): Promise<Event[]> {
    const query = `
      SELECT id, event_type as "eventType", payload, created_at as "createdAt"
      FROM events
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(query, [limit, offset]);
    return result.rows;
  }

  async getEventById(id: string): Promise<Event | null> {
    const query = `
      SELECT id, event_type as "eventType", payload, created_at as "createdAt"
      FROM events
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async getEventsByType(
    eventType: string,
    limit: number = 100,
  ): Promise<Event[]> {
    const query = `
      SELECT id, event_type as "eventType", payload, created_at as "createdAt"
      FROM events
      WHERE event_type = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [eventType, limit]);
    return result.rows;
  }

  async getEventsCount(): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM events`;
    const result = await this.pool.query(query);
    return parseInt(result.rows[0].count) || 0;
  }
}
