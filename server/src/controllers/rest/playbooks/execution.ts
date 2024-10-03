import { API } from 'ssm-shared-lib';
import AnsibleLogsRepo from '../../../data/database/repository/AnsibleLogsRepo';
import AnsibleTaskStatusRepo from '../../../data/database/repository/AnsibleTaskStatusRepo';
import PlaybookRepo from '../../../data/database/repository/PlaybookRepo';
import { InternalError, NotFoundError } from '../../../middlewares/api/ApiError';
import { SuccessResponse } from '../../../middlewares/api/ApiResponse';
import PlaybookUseCases from '../../../services/PlaybookUseCases';

export const execPlaybook = async (req, res) => {
  const { uuid } = req.params;

  const playbook = await PlaybookRepo.findOneByUuid(uuid);
  if (!playbook) {
    throw new NotFoundError(`Playbook ${uuid} not found`);
  }
  if (!req.user) {
    throw new NotFoundError('No user');
  }
  try {
    const execId = await PlaybookUseCases.executePlaybook(
      playbook,
      req.user,
      req.body.target,
      req.body.extraVars as API.ExtraVars,
      req.body.mode,
    );
    new SuccessResponse('Execution succeeded', { execId: execId } as API.ExecId).send(res);
  } catch (error: any) {
    throw new InternalError(error.message);
  }
};

export const execPlaybookByQuickRef = async (req, res) => {
  const { quickRef } = req.params;

  const playbook = await PlaybookRepo.findOneByUniqueQuickReference(quickRef);
  if (!playbook) {
    throw new NotFoundError(`Playbook ${quickRef} not found`);
  }
  if (!req.user) {
    throw new NotFoundError('No user');
  }
  try {
    const execId = await PlaybookUseCases.executePlaybook(
      playbook,
      req.user,
      req.body.target,
      req.body.extraVars as API.ExtraVars,
      req.body.mode,
    );
    new SuccessResponse('Execution succeeded', { execId: execId } as API.ExecId).send(res);
  } catch (error: any) {
    throw new InternalError(error.message);
  }
};

export const getLogs = async (req, res) => {
  const execLogs = await AnsibleLogsRepo.findAllByIdent(req.params.id);
  new SuccessResponse('Execution logs', {
    execId: req.params.id,
    execLogs: execLogs,
  } as API.ExecLogs).send(res);
};

export const getStatus = async (req, res) => {
  if (!req.params.id) {
    res.status(400).send({
      success: false,
    });
    return;
  }
  const taskStatuses = await AnsibleTaskStatusRepo.findAllByIdent(req.params.id);
  new SuccessResponse('Execution status', {
    execId: req.params.id,
    execStatuses: taskStatuses,
  } as API.ExecStatuses).send(res);
};
