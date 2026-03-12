import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { Attachment } from '../entities/attachment.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AttachmentRepository {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async createAttachment(
    entityType: string,
    entityId: string,
    fileUrl: string,
  ): Promise<Attachment> {
    const id = uuidv4();
    const query = `
      INSERT INTO attachments (id, entity_type, entity_id, file_url)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [id, entityType, entityId, fileUrl];
    const result = await this.pool.query(query, values);
    return new Attachment({
      id: result.rows[0].id,
      entityType: result.rows[0].entity_type,
      entityId: result.rows[0].entity_id,
      fileUrl: result.rows[0].file_url,
    });
  }

  async getAttachmentById(id: string): Promise<Attachment | null> {
    const query = 'SELECT * FROM attachments WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) {
      return null;
    }
    return new Attachment({
      id: result.rows[0].id,
      entityType: result.rows[0].entity_type,
      entityId: result.rows[0].entity_id,
      fileUrl: result.rows[0].file_url,
    });
  }

  async getAttachmentsByEntity(entityType: string, entityId: string): Promise<Attachment[]> {
    const query = 'SELECT * FROM attachments WHERE entity_type = $1 AND entity_id = $2';
    const result = await this.pool.query(query, [entityType, entityId]);
    return result.rows.map(
      (row) =>
        new Attachment({
          id: row.id,
          entityType: row.entity_type,
          entityId: row.entity_id,
          fileUrl: row.file_url,
        }),
    );
  }

  async deleteAttachment(id: string): Promise<void> {
    const query = 'DELETE FROM attachments WHERE id = $1';
    await this.pool.query(query, [id]);
  }
}
