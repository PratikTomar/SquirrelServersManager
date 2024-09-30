import CreateVolumeModal from '@/pages/Containers/components/sub-components/CreateVolumeModal';
import { getAllDevices } from '@/services/rest/device';
import { getVolumes } from '@/services/rest/services';
import {
  ActionType,
  ProColumns,
  ProFormSelect,
  ProTable,
  RequestOptionsType,
} from '@ant-design/pro-components';
import { Tag, Tooltip } from 'antd';
import React, { useRef } from 'react';
import { API } from 'ssm-shared-lib';

const Volumes: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const columns: ProColumns<API.ContainerVolume>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      ellipsis: true,
    },
    {
      dataIndex: 'deviceUuid',
      hideInTable: true,
      title: 'Device',
      renderFormItem: () => (
        <ProFormSelect
          request={async () => {
            return await getAllDevices().then((e: API.DeviceList) => {
              return e.data?.map((f: API.DeviceItem) => {
                return {
                  label: `${f.fqdn} (${f.ip})`,
                  value: f.uuid,
                };
              }) as RequestOptionsType[];
            });
          }}
        />
      ),
    },
    {
      title: 'Device',
      dataIndex: ['device', 'ip'],
      search: false,
      render: (text, record) => (
        <Tooltip title={record.device?.fqdn}>
          <Tag>{record.device?.ip}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Scope',
      dataIndex: 'scope',
    },
    {
      title: 'Driver',
      dataIndex: 'driver',
    },
    {
      title: 'Mount Point',
      dataIndex: 'mountPoint',
      ellipsis: true,
      search: false,
    },
  ];

  return (
    <ProTable<API.ContainerVolume>
      columns={columns}
      request={getVolumes}
      rowKey="name"
      search={{
        filterType: 'light',
      }}
      options={false}
      pagination={{
        defaultPageSize: 20,
        showSizeChanger: true,
      }}
      toolBarRender={() => [<CreateVolumeModal key={'create-volume'} />]}
    />
  );
};

export default Volumes;
