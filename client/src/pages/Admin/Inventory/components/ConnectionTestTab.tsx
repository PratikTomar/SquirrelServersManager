import CheckDeviceConnection from '@/components/DeviceConfiguration/CheckDeviceConnection';
import { StreamlineComputerConnection } from '@/components/Icons/CustomIcons';
import {
  getCheckDeviceAnsibleConnection,
  getCheckDeviceDockerConnection,
} from '@/services/rest/device';
import { ProForm } from '@ant-design/pro-components';
import { Avatar, Button, Card, Col, Row } from 'antd';
import React, { useState } from 'react';
import { API } from 'ssm-shared-lib';

export type ConnectionTestTabProps = {
  device: Partial<API.DeviceItem>;
};

const ConnectionTestTab: React.FC<ConnectionTestTabProps> = (props) => {
  const [execId, setExecId] = useState<string | undefined>();
  const [dockerConnectionStatus, setDockerConnectionStatus] = useState<
    string | undefined
  >();
  const [dockerConnectionErrorMessage, setDockerConnectionErrorMessage] =
    useState<string | undefined>();
  const [testStarted, setTestStarted] = useState(false);
  const asyncFetch = async () => {
    if (!props.device.uuid) {
      return;
    }
    setExecId(undefined);
    setDockerConnectionErrorMessage(undefined);
    setDockerConnectionStatus('running...');
    setTestStarted(true);
    await getCheckDeviceAnsibleConnection(props.device.uuid).then((e) => {
      setExecId(e.data.taskId);
    });
    await getCheckDeviceDockerConnection(props.device.uuid).then((e) => {
      setDockerConnectionStatus(e.data.connectionStatus);
      setDockerConnectionErrorMessage(e.data.errorMessage);
    });
  };
  return (
    <Card
      type="inner"
      title={
        <Row>
          <Col>
            <Avatar
              style={{ backgroundColor: '#16728e' }}
              shape="square"
              icon={<StreamlineComputerConnection />}
            />
          </Col>
          <Col
            style={{
              marginLeft: 10,
              marginTop: 'auto',
              marginBottom: 'auto',
            }}
          >
            Test connections
          </Col>
        </Row>
      }
      style={{ marginBottom: 10 }}
      styles={{
        header: { height: 55, minHeight: 55, paddingLeft: 15 },
        body: { paddingBottom: 0 },
      }}
    >
      {testStarted && (
        <CheckDeviceConnection
          execId={execId}
          dockerConnRes={dockerConnectionStatus}
          dockerConnErrorMessage={dockerConnectionErrorMessage}
        />
      )}
      <Button style={{ marginBottom: 20 }} onClick={asyncFetch}>
        Run connection tests
      </Button>
    </Card>
  );
};

export default ConnectionTestTab;
