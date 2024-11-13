import InAppNotification from '../../data/database/model/InAppNotification';
import InAppNotificationRepo from '../../data/database/repository/InAppNotificationRepo';
import EventManager, { Payload } from '../../core/events/EventManager';
import Events from '../../core/events/events';
import pinoLogger from '../../logger';

class NotificationComponent extends EventManager {
  private childLogger = pinoLogger.child(
    { module: `Notification` },
    { msgPrefix: '[NOTIFICATION] - ' },
  );

  private eventsToListen = [
    Events.AUTOMATION_FAILED,
    Events.DOCKER_STAT_FAILED,
    Events.DOCKER_WATCH_FAILED,
  ];

  constructor() {
    super();
  }

  async init() {
    this.childLogger.info('Initialization....');
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    this.eventsToListen.forEach((event) => {
      this.on(event, (payload: Payload) => this.handleNotificationEvent(event, payload));
    });
  }

  private async handleNotificationEvent(event: string, payload: Payload) {
    try {
      const { message, severity, module, moduleId } = payload;
      this.childLogger.info(`handleNotificationEvent - Notification received - (event: ${event})`);

      await InAppNotificationRepo.create({
        event,
        message,
        severity,
        module,
        moduleId,
      } as InAppNotification);
      this.emit(Events.UPDATED_NOTIFICATIONS, 'Updated Notification');
    } catch (error) {
      this.childLogger?.error(error);
    }
  }
}

export default new NotificationComponent();
