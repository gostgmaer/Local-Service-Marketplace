import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { Pool } from 'pg';

describe('NotificationController (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let notificationId: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter(app.get('WINSTON_MODULE_NEST_PROVIDER')));
    await app.init();

    pool = app.get('DATABASE_POOL');

    // Create test user (in a real scenario, this would be created by auth-service)
    const userResult = await pool.query(
      'INSERT INTO users (id, email, password_hash, first_name, last_name, role, created_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW()) RETURNING id',
      ['test@example.com', 'hash123', 'John', 'Doe', 'user'],
    );
    testUserId = userResult.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    if (notificationId) {
      await pool.query('DELETE FROM notification_deliveries WHERE notification_id = $1', [notificationId]);
      await pool.query('DELETE FROM notifications WHERE id = $1', [notificationId]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM notification_deliveries WHERE notification_id IN (SELECT id FROM notifications WHERE user_id = $1)', [testUserId]);
      await pool.query('DELETE FROM notifications WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    await pool.end();
    await app.close();
  });

  describe('Notification Creation (via service)', () => {
    it('should create a notification with delivery records', async () => {
      // Create notification directly via repository (simulating event-driven creation)
      const result = await pool.query(
        'INSERT INTO notifications (id, user_id, type, message, read, created_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW()) RETURNING *',
        [testUserId, 'job_accepted', 'Your job proposal has been accepted', false],
      );
      notificationId = result.rows[0].id;

      // Create delivery records
      await pool.query(
        'INSERT INTO notification_deliveries (id, notification_id, channel, status) VALUES (gen_random_uuid(), $1, $2, $3)',
        [notificationId, 'email', 'pending'],
      );
      await pool.query(
        'INSERT INTO notification_deliveries (id, notification_id, channel, status) VALUES (gen_random_uuid(), $1, $2, $3)',
        [notificationId, 'push', 'pending'],
      );

      expect(notificationId).toBeDefined();
    });
  });

  describe('GET /notifications', () => {
    it('should retrieve notifications for a user', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('x-user-id', testUserId)
        .expect(200);

      expect(response.body.notifications).toBeDefined();
      expect(Array.isArray(response.body.notifications)).toBe(true);
      expect(response.body.notifications.length).toBeGreaterThan(0);
      expect(response.body.unreadCount).toBeDefined();
      expect(response.body.unreadCount).toBeGreaterThan(0);
    });

    it('should retrieve notifications with custom limit', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications')
        .query({ limit: 5 })
        .set('x-user-id', testUserId)
        .expect(200);

      expect(response.body.notifications).toBeDefined();
      expect(response.body.notifications.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /notifications/:id', () => {
    it('should retrieve a notification by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/notifications/${notificationId}`)
        .expect(200);

      expect(response.body.notification).toBeDefined();
      expect(response.body.notification.id).toBe(notificationId);
      expect(response.body.notification.userId).toBe(testUserId);
      expect(response.body.notification.read).toBe(false);
    });

    it('should return 404 for non-existent notification', async () => {
      await request(app.getHttpServer())
        .get(`/notifications/00000000-0000-0000-0000-000000000000`)
        .expect(404);
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/notifications/${notificationId}/read`)
        .expect(200);

      expect(response.body.notification).toBeDefined();
      expect(response.body.notification.id).toBe(notificationId);
      expect(response.body.notification.read).toBe(true);
    });

    it('should be idempotent (marking already read notification)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/notifications/${notificationId}/read`)
        .expect(200);

      expect(response.body.notification.read).toBe(true);
    });

    it('should return 404 for non-existent notification', async () => {
      await request(app.getHttpServer())
        .patch(`/notifications/00000000-0000-0000-0000-000000000000/read`)
        .expect(404);
    });
  });

  describe('Worker Endpoints', () => {
    beforeEach(async () => {
      // Create a new notification with pending deliveries for testing workers
      const result = await pool.query(
        'INSERT INTO notifications (id, user_id, type, message, read, created_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW()) RETURNING id',
        [testUserId, 'test_notification', 'Worker test message', false],
      );
      const workerId = result.rows[0].id;

      await pool.query(
        'INSERT INTO notification_deliveries (id, notification_id, channel, status) VALUES (gen_random_uuid(), $1, $2, $3)',
        [workerId, 'email', 'pending'],
      );
      await pool.query(
        'INSERT INTO notification_deliveries (id, notification_id, channel, status) VALUES (gen_random_uuid(), $1, $2, $3)',
        [workerId, 'push', 'pending'],
      );
    });

    describe('POST /notifications/workers/process-emails', () => {
      it('should process pending email deliveries', async () => {
        const response = await request(app.getHttpServer())
          .post('/notifications/workers/process-emails')
          .expect(201);

        expect(response.body.message).toBe('Email processing completed');

        // Verify that email deliveries were processed
        const deliveries = await pool.query(
          'SELECT * FROM notification_deliveries WHERE channel = $1 AND status = $2',
          ['email', 'sent'],
        );
        expect(deliveries.rows.length).toBeGreaterThan(0);
      });
    });

    describe('POST /notifications/workers/process-push', () => {
      it('should process pending push notification deliveries', async () => {
        const response = await request(app.getHttpServer())
          .post('/notifications/workers/process-push')
          .expect(201);

        expect(response.body.message).toBe('Push notification processing completed');

        // Verify that push deliveries were processed
        const deliveries = await pool.query(
          'SELECT * FROM notification_deliveries WHERE channel = $1 AND status = $2',
          ['push', 'sent'],
        );
        expect(deliveries.rows.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Unread Count', () => {
    it('should reflect correct unread count after marking as read', async () => {
      // Get initial unread count
      const response1 = await request(app.getHttpServer())
        .get('/notifications')
        .set('x-user-id', testUserId)
        .expect(200);

      const initialUnreadCount = response1.body.unreadCount;

      // Mark a notification as read
      await request(app.getHttpServer())
        .patch(`/notifications/${notificationId}/read`)
        .expect(200);

      // Get updated unread count
      const response2 = await request(app.getHttpServer())
        .get('/notifications')
        .set('x-user-id', testUserId)
        .expect(200);

      expect(response2.body.unreadCount).toBeLessThanOrEqual(initialUnreadCount);
    });
  });
});
