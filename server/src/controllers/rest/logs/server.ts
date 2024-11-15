import { parse } from 'url';
import { API } from 'ssm-shared-lib';
import LogsRepo from '../../../data/database/repository/LogsRepo';
import { filterByFields, filterByQueryParams } from '../../../helpers/query/FilterHelper';
import { paginate } from '../../../helpers/query/PaginationHelper';
import { sortByFields } from '../../../helpers/query/SorterHelper';
import { SuccessResponse } from '../../../middlewares/api/ApiResponse';

export const getServerLogs = async (req, res) => {
  const realUrl = req.url;
  const { current = 1, pageSize = 10 } = req.query;
  const params = parse(realUrl, true).query as unknown as API.PageParams &
    API.ServerLog & {
      sorter: any;
      filter: any;
    };
  const logs = await LogsRepo.findAll();
  // Add pagination
  // Use the separated services
  let dataSource = sortByFields(logs, params);
  dataSource = filterByFields(dataSource, params);
  //TODO: update validator
  dataSource = filterByQueryParams(dataSource, params, [
    'time',
    'pid',
    'level',
    'msg',
    'module',
    'moduleId',
    'moduleName',
  ]);
  const totalBeforePaginate = dataSource?.length || 0;
  dataSource = paginate(dataSource, current as number, pageSize as number);
  new SuccessResponse('Get server logs successful', dataSource, {
    total: totalBeforePaginate,
    success: true,
    pageSize,
    current: parseInt(`${params.current}`, 10) || 1,
  }).send(res);
};
