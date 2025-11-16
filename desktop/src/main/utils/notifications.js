import { Notification } from 'electron';
import logger from './logger.js';

function showNotification(title, body, options = {}) {
    if (Notification.isSupported()) {
        const notification = new Notification({
            title,
            body,
            ...options,
        });

        notification.show();
        logger.info('Notification shown:', title);
        return notification;
    } else {
        logger.warn('Notifications not supported on this platform');
        return null;
    }
}

export { showNotification };