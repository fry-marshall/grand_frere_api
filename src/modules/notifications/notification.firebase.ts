import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationFirebase implements OnModuleInit {
  private readonly logger = new Logger(NotificationFirebase.name);
  private firebaseApp: admin.app.App;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  onModuleInit() {
    if (this.configService.get('NODE_ENV') !== 'prod') {
      this.logger.log('Firebase initialization skipped (NODE_ENV is not prod)');
      return;
    }

    const serviceAccountJson = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT',
    );

    this.logger.log(
      `Firebase env check — FIREBASE_SERVICE_ACCOUNT: ${serviceAccountJson ? 'set' : 'MISSING'}`,
    );

    if (!serviceAccountJson) {
      this.logger.error(
        'FIREBASE_SERVICE_ACCOUNT env var is missing — push notifications will not work',
      );
    }

    if (admin.apps.length > 0) {
      this.firebaseApp = admin.apps[0]!;
      this.logger.log('Firebase app already initialized, reusing instance');
      return;
    }

    try {
      const serviceAccount = JSON.parse(
        this.configService.getOrThrow<string>('FIREBASE_SERVICE_ACCOUNT'),
      ) as admin.ServiceAccount;
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      this.logger.log('Firebase app initialized successfully');
    } catch (err) {
      this.logger.error(
        'Failed to initialize Firebase app',
        (err as Error).stack,
      );
      throw err;
    }
  }

  async send(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.firebaseApp) {
      this.logger.warn(
        `Firebase app not initialized, skipping push for user ${userId}`,
      );
      return;
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.fcmToken) {
      this.logger.debug(`No FCM token for user ${userId}, skipping push`);
      return;
    }

    try {
      await this.firebaseApp.messaging().send({
        token: user.fcmToken,
        notification: { title, body },
        data,
      });
      this.logger.debug(`Push sent to user ${userId}`);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        await this.userRepo.update(userId, { fcmToken: null });
        this.logger.warn(`Cleared invalid FCM token for user ${userId}`);
      } else {
        throw err;
      }
    }
  }
}
