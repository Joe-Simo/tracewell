import { useEffect, useState } from 'react';
import ForgeReconciler, {
  Button,
  DynamicTable,
  Heading,
  Inline,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  Textfield,
} from '@forge/react';
import { call } from './call';

type Item = { key: string; summary: string };
type Row = { need: Item; inputs: Item[]; outputs: Item[]; verifications: Item[]; validations: Item[] };
type Overview = {
  projectKey: string;
  coverage: { met: number; required: number; percent: number };
  gaps: { message: string; severity: string; key: string }[];
  matrix: Row[];
  csv: string;
};
type Ready = { summary: string; ready: boolean; blockers: { message: string }[] };

const keys = (xs: Item[]) => xs.map((x) => x.key).join(', ') || '-';

const App = () => {
  const [o, setO] = useState<Overview>();
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState('');
  const [ready, setReady] = useState<Ready>();
  useEffect(() => {
    call<Overview>('overview').then(setO, (e) => setError(String(e)));
  }, []);
  if (error) return <SectionMessage appearance="error">{error}</SectionMessage>;
  if (!o) return <Spinner />;
  const blockers = o.gaps.filter((g) => g.severity === 'blocker');
  return (
    <Stack space="space.300">
      <Inline space="space.100" alignBlock="center">
        <Heading size="medium">{`Trace coverage ${o.coverage.percent}%`}</Heading>
        <Lozenge appearance={blockers.length ? 'removed' : 'success'}>
          {blockers.length ? `${blockers.length} blockers` : 'No blockers'}
        </Lozenge>
      </Inline>
      <Text>{`${o.coverage.met} of ${o.coverage.required} required trace links in ${o.projectKey}.`}</Text>
      <Inline space="space.100" alignBlock="end">
        <Textfield name="version" placeholder="Fix version, e.g. 2.1.0" onChange={(e) => setVersion(e.target.value)} />
        <Button onClick={() => call<Ready>('readiness', { version }).then(setReady, (e) => setError(String(e)))}>
          Check release
        </Button>
      </Inline>
      {ready && (
        <SectionMessage appearance={ready.ready ? 'success' : 'error'} title={ready.summary}>
          {ready.blockers.slice(0, 10).map((b) => (
            <Text key={b.message}>{b.message}</Text>
          ))}
        </SectionMessage>
      )}
      <Heading size="small">Gaps</Heading>
      {o.gaps.length === 0 ? <Text>None</Text> : o.gaps.slice(0, 50).map((g) => <Text key={g.message}>{g.message}</Text>)}
      <Heading size="small">Trace matrix</Heading>
      <DynamicTable
        head={{
          cells: ['User need', 'Design inputs', 'Design outputs', 'Verification', 'Validation'].map((c) => ({ key: c, content: c })),
        }}
        rows={o.matrix.map((r) => ({
          key: r.need.key,
          cells: [
            { key: 'n', content: `${r.need.key} ${r.need.summary}` },
            { key: 'i', content: keys(r.inputs) },
            { key: 'o', content: keys(r.outputs) },
            { key: 'v', content: keys(r.verifications) },
            { key: 'a', content: keys(r.validations) },
          ],
        }))}
      />
    </Stack>
  );
};

ForgeReconciler.render(<App />);
