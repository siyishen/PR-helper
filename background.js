const API = require('./src/api');
const BadgeService = require('./src/badge');
const NotificationsService = require('./src/notifications-service');
const PermissionsService = require('./src/permissions-service');
const PersistenceService = require('./src/persistence-service');
const TabsService = require('./src/tabs-service');

function handleInterval(interval) {
    const intervalSetting = parseInt(PersistenceService.get('interval'), 10) || 60;
    const intervalValue = interval || 60;

    if (intervalSetting !== intervalValue) {
        PersistenceService.set('interval', intervalValue);
    }

    // delay less than 1 minute will cause a warning
    const delayInMinutes = Math.max(Math.ceil(intervalValue / 60), 1);

    window.chrome.alarms.create({delayInMinutes});
}

function handleLastModified(date) {
    let lastModified = PersistenceService.get('lastModified');
    const emptyLastModified = String(lastModified) === 'null' || String(lastModified) === 'undefined';
    lastModified = emptyLastModified ? new Date(0) : lastModified;

    if (date !== lastModified) {
        PersistenceService.set('lastModified', date);
        if (PersistenceService.get('showDesktopNotif') === true) {
            NotificationsService.checkNotifications(lastModified);
        }
    }
}

function handleNotificationsResponse(response) {
    const {count, interval, lastModified} = response;

    handleInterval(interval);
    handleLastModified(lastModified);

    BadgeService.renderCount(count);
}

function update() {
    API.getNotifications().then(handleNotificationsResponse).catch(handleError);
}

function handleError(error) {
    BadgeService.renderError(error);
}

function handleBrowserActionClick(tab) {
    const tabUrl = API.getTabUrl();

    // request optional permissions the first time
    if (PersistenceService.get('tabs_permission') === undefined) {
        PermissionsService.requestPermission('tabs').then(granted => {
            PersistenceService.set('tabs_permission', granted);
        TabsService.openTab(tabUrl, tab);
    });
    } else {
        TabsService.openTab(tabUrl, tab);
    }
}

function handleInstalled(details) {
    if (details.reason === 'install') {
        window.chrome.runtime.openOptionsPage();
    }
}

window.chrome.alarms.create({when: Date.now() + 2000});
window.chrome.alarms.onAlarm.addListener(update);
window.chrome.runtime.onMessage.addListener(update);

PermissionsService.queryPermission('notifications').then(granted => {
    if (granted) {
        window.chrome.notifications.onClicked.addListener(id => {
            NotificationsService.openNotification(id);
    });

        window.chrome.notifications.onClosed.addListener(id => {
            NotificationsService.removeNotification(id);
    });
    }
});

window.chrome.runtime.onInstalled.addListener(handleInstalled);
window.chrome.browserAction.onClicked.addListener(handleBrowserActionClick);

update();