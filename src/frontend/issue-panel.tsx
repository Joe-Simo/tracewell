import { useEffect, useState } from 'react';
import ForgeReconciler, { Box, Button, Heading, Inline, Lozenge, SectionMessage, Spinner, Stack, Text } from '@forge/react';
import { rovo } from '@forge/bridge';
import { call } from './call';
import { askPrompt, plural } from './view';

type Brief = { key: string; kind: string; summary: string; status?: string };
type Trace = {
  key: string;
  kind: string;
  upstream: Brief[];
  downstream: Brief[];
  gaps: { message: string; severity: string }[];
  suspectBecause: string[];
  impact?: { text: string };
};

const List = ({ title, rows }: { title: string; rows: Brief[] }) => (
  <Stack space="space.050">
    <Heading size="small">{title}</Heading>
    {rows.length === 0 ? (
      <Text>None</Text>
    ) : (
      rows.map((r) => (
        <Inline key={r.key} space="space.100">
          <Lozenge>{r.kind}</Lozenge>
          <Text>{`${r.key} ${r.summary}${r.status ? ` (${r.status})` : ''}`}</Text>
        </Inline>
      ))
    )}
  </Stack>
);

const App = () => {
  const [data, setData] = useState<Trace | null | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [rovoOn, setRovoOn] = useState(false);
  useEffect(() => {
    call<Trace | null>('issueTrace').then(setData, (e) => setError(String(e)));
    rovo.isEnabled().then(setRovoOn, () => setRovoOn(false));
  }, []);
  if (error) return <SectionMessage appearance="error">{error}</SectionMessage>;
  if (data === undefined) return <Spinner />;
  if (data === null)
    return <Text>This issue is not part of the trace. Give it a design-control issue type or a tw- label.</Text>;
  const ask = () =>
    rovo.open({ type: 'forge', agentKey: 'tracewell-agent', agentName: 'Tracewell', prompt: askPrompt(data.key, data.kind) });
  return (
    <Box>
      <Stack space="space.200">
        <Inline space="space.100" alignBlock="center" spread="space-between">
          <Inline space="space.100">
            <Lozenge appearance="new">{data.kind}</Lozenge>
            {data.gaps.length === 0 ? (
              <Lozenge appearance="success">Traced</Lozenge>
            ) : (
              <Lozenge appearance="removed">{plural(data.gaps.length, 'gap')}</Lozenge>
            )}
          </Inline>
          {rovoOn && (
            <Button appearance="subtle" onClick={ask}>
              Ask Tracewell
            </Button>
          )}
        </Inline>
        {data.suspectBecause.length > 0 && (
          <SectionMessage appearance="warning" title="Suspect result">
            <Text>{`Passed before ${data.suspectBecause.join(', ')} changed. Re-run before release.`}</Text>
          </SectionMessage>
        )}
        {data.gaps.map((g) => (
          <Text key={g.message}>{g.message}</Text>
        ))}
        <List title="Traces to" rows={data.upstream} />
        <List title="Traced by" rows={data.downstream} />
        {data.impact && (
          <SectionMessage appearance="information" title="If this changes">
            <Text>{data.impact.text}</Text>
          </SectionMessage>
        )}
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(<App />);
