import { SsmContainer } from 'ssm-shared-lib';
import Container from '../data/database/model/Container';
import ContainerRepo from '../data/database/repository/ContainerRepo';
import { Kind } from '../modules/docker/core/Component';
import { WATCHERS } from '../modules/docker/core/conf';
import WatcherEngine from '../modules/docker/core/WatcherEngine';
import Docker from '../modules/docker/watchers/providers/docker/Docker';

async function updateCustomName(customName: string, container: Container): Promise<void> {
  container.customName = customName;
  await ContainerRepo.updateContainer(container);
}

async function performAction(container: Container, action: SsmContainer.Actions): Promise<void> {
  const registeredComponent = WatcherEngine.getStates().watcher[
    WatcherEngine.buildId(Kind.WATCHER, WATCHERS.DOCKER, container.watcher)
  ] as Docker;
  if (!registeredComponent) {
    throw new Error('Watcher is not registered');
  }
  switch (action) {
    case SsmContainer.Actions.KILL:
      return await registeredComponent.killContainer(container);
    case SsmContainer.Actions.PAUSE:
      return await registeredComponent.pauseContainer(container);
    case SsmContainer.Actions.RESTART:
      return await registeredComponent.restartContainer(container);
    case SsmContainer.Actions.STOP:
      return await registeredComponent.stopContainer(container);
    case SsmContainer.Actions.START:
      return await registeredComponent.startContainer(container);
    default:
      throw new Error(`Unknown action type ${action}`);
  }
}

export default {
  updateCustomName,
  performAction,
};
