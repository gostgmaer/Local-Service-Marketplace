import { Injectable, Inject } from "@nestjs/common";
import { Pool } from "pg";
import { Attachment } from "../entities/attachment.entity";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class AttachmentRepository {
  constructor(@Inject("DATABASE_POOL") private pool: Pool) {}

  async createAttachment(
    messageId: string,
    fileId: string,
    fileName?: string,
    fileSize?: number,
    mimeType?: string,
  ): Promise<Attachment> {
    const id = uuidv4();
    // SECURITY: store only the file service ID, not the raw Azure Blob URL.
    // The URL is resolved on-demand via an authenticated API call.
    const query = `
      INSERT INTO attachments (id, message_id, file_id, file_url, file_name, file_size, mime_type, created_at)
      VALUES ($1, $2, $3, NULL, $4, $5, $6, NOW())
      RETURNING *
    `;
    const values = [id, messageId, fileId, fileName, fileSize, mimeType];
    const result = await this.pool.query(query, values);
    return new Attachment({
      id: result.rows[0].id,
      message_id: result.rows[0].message_id,
      file_id: result.rows[0].file_id,
      file_url: result.rows[0].file_url,
      file_name: result.rows[0].file_name,
      file_size: result.rows[0].file_size,
      mime_type: result.rows[0].mime_type,
      created_at: result.rows[0].created_at,
    });
  }

  async getAttachmentById(id: string): Promise<Attachment | null> {
    const query = "SELECT * FROM attachments WHERE id = $1";
    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) {
      return null;
    }
    return new Attachment({
      id: result.rows[0].id,
      message_id: result.rows[0].message_id,
      file_id: result.rows[0].file_id,
      file_url: result.rows[0].file_url,
      file_name: result.rows[0].file_name,
      file_size: result.rows[0].file_size,
      mime_type: result.rows[0].mime_type,
      created_at: result.rows[0].created_at,
    });
  }

  async getAttachmentsByMessageId(messageId: string): Promise<Attachment[]> {
    const query =
      "SELECT * FROM attachments WHERE message_id = $1 ORDER BY created_at ASC";
    const result = await this.pool.query(query, [messageId]);
    return result.rows.map(
      (row) =>
        new Attachment({
          id: row.id,
          message_id: row.message_id,
          file_id: row.file_id,
          file_url: row.file_url,
          file_name: row.file_name,
          file_size: row.file_size,
          mime_type: row.mime_type,
          created_at: row.created_at,
        }),
    );
  }

  async deleteAttachment(id: string): Promise<void> {
    const query = "DELETE FROM attachments WHERE id = $1";
    await this.pool.query(query, [id]);
  }

  async getTotalSizeByMessageId(messageId: string): Promise<number> {
    const query =
      "SELECT COALESCE(SUM(file_size), 0)::bigint AS total FROM attachments WHERE message_id = $1";
    const result = await this.pool.query(query, [messageId]);
    return Number(result.rows[0]?.total ?? 0);
  }
}
