import { useEffect, useState } from 'react';
import ForgeReconciler, {
  BarChart,
  Button,
  CodeBlock,
  DynamicTable,
  Heading,
  Inline,
  Link,
  Lozenge,
  ProgressBar,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  Textfield,
} from '@forge/react';
import { call } from './call';
import { coverageAppearance, gapChart, groupGaps, plural, riskAppearance } from './view';

type Item = { key: string; summary: string; result?: string };
type Row = { need: Item; inputs: Item[]; outputs: Item[]; verifications: Item[]; validations: Item[] };
type Risk = { hazard: Item; controls: Item[]; verifications: Item[]; state: string };
type Gap = { message: string; severity: string; key: string; type: string };
type Overview = {
  projectKey: string;
  counts: { kind: string; label: string; count: number }[];
  gapCounts: { type: string; count: number }[];
  coverage: { met: number; required: number; percent: number };
  gaps: Gap[];
  matrix: Row[];
  risks: Risk[];
  versions: string[];
  csv: string;
  configErrors: string[];
};
type Ready = { summary: string; ready: boolean; blockers: { message: string }[]; warnings: { message: string }[] };
type Published = { error?: string; title?: string; url?: string; version?: number; created?: boolean };

const keys = (xs: Item[]) => xs.map((x) => x.key).join(', ') || '-';

const Summary = ({ o }: { o: Overview }) => {
  const blockers = o.gaps.filter((g) => g.severity === 'blocker').length;
  return (
    <Stack space="space.200">
      <Inline space="space.100" alignBlock="center">
        <Heading size="medium">{`Trace coverage ${o.coverage.percent}%`}</Heading>
        <Lozenge appearance={coverageAppearance(o.coverage.percent)}>{`${o.coverage.met} of ${o.coverage.required} links`}</Lozenge>
        <Lozenge appearance={blockers ? 'removed' : 'success'}>{blockers ? plural(blockers, 'blocker') : 'No blockers'}</Lozenge>
      </Inline>
      <ProgressBar value={o.coverage.percent / 100} appearance={o.coverage.percent >= 100 ? 'success' : 'default'} />
      <Text>{o.counts.map((c) => `${c.count} ${c.label.toLowerCase()}`).join(', ') || 'No design-control items yet.'}</Text>
      {o.gapCounts.length > 0 && <BarChart data={gapChart(o.gapCounts)} xAccessor="label" yAccessor="count" title="Gaps by type" height={220} />}
      {groupGaps(o.gaps).map((grp) => (
        <Stack key={grp.type} space="space.050">
          <Heading size="small">{`${grp.label} (${grp.gaps.length})`}</Heading>
          {grp.gaps.slice(0, 25).map((g) => (
            <Text key={g.message}>{g.message}</Text>
          ))}
        </Stack>
      ))}
    </Stack>
  );
};

const Matrix = ({ o }: { o: Overview }) => (
  <Stack space="space.200">
    <DynamicTable
      head={{ cells: ['User need', 'Design inputs', 'Design outputs', 'Verification', 'Validation'].map((c) => ({ key: c, content: c })) }}
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
      emptyView={<Text>No user needs found.</Text>}
    />
    <Heading size="small">CSV for your design history file</Heading>
    <CodeBlock language="text" text={o.csv} />
  </Stack>
);

const Risks = ({ o }: { o: Overview }) => (
  <DynamicTable
    head={{ cells: ['Hazard', 'Risk controls', 'Verification', 'State'].map((c) => ({ key: c, content: c })) }}
    rows={o.risks.map((r) => ({
      key: r.hazard.key,
      cells: [
        { key: 'h', content: `${r.hazard.key} ${r.hazard.summary}` },
        { key: 'c', content: keys(r.controls) },
        { key: 'v', content: r.verifications.map((v) => `${v.key} ${v.result ?? ''}`.trim()).join(', ') || '-' },
        { key: 's', content: <Lozenge appearance={riskAppearance(r.state)}>{r.state}</Lozenge> },
      ],
    }))}
    emptyView={<Text>No hazards found.</Text>}
  />
);

const Release = ({ o }: { o: Overview }) => {
  const [version, setVersion] = useState(o.versions[0] ?? '');
  const [spaceKey, setSpaceKey] = useState('');
  const [ready, setReady] = useState<Ready>();
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<Published>();
  const check = () => {
    setBusy(true);
    call<Ready>('readiness', { version })
      .then(setReady, (e) => setReady({ summary: String(e), ready: false, blockers: [], warnings: [] }))
      .finally(() => setBusy(false));
  };
  const publish = () => {
    setBusy(true);
    call<Published>('publish', { version, spaceKey })
      .then(setPublished, (e) => setPublished({ error: String(e) }))
      .finally(() => setBusy(false));
  };
  return (
    <Stack space="space.200">
      <Inline space="space.100" alignBlock="end">
        {o.versions.length > 0 ? (
          <Select
            inputId="version"
            options={o.versions.map((v) => ({ label: v, value: v }))}
            defaultValue={version ? { label: version, value: version } : undefined}
            onChange={(opt: { value: string } | null) => setVersion(opt?.value ?? '')}
          />
        ) : (
          <Textfield name="version" placeholder="Fix version, e.g. 2.1.0" onChange={(e) => setVersion(e.target.value)} />
        )}
        <Button appearance="primary" isDisabled={!version || busy} onClick={check}>
          Check release
        </Button>
      </Inline>
      {ready && (
        <SectionMessage appearance={ready.ready ? 'success' : 'error'} title={ready.summary}>
          {ready.blockers.slice(0, 15).map((b) => (
            <Text key={b.message}>{b.message}</Text>
          ))}
        </SectionMessage>
      )}
      <Heading size="small">Publish the trace report to Confluence</Heading>
      <Inline space="space.100" alignBlock="end">
        <Textfield name="spaceKey" placeholder="Space key, e.g. QMS" onChange={(e) => setSpaceKey(e.target.value)} />
        <Button isDisabled={!version || !spaceKey || busy} onClick={publish}>
          Publish report
        </Button>
      </Inline>
      {published?.error && <SectionMessage appearance="error">{published.error}</SectionMessage>}
      {published?.title && (
        <SectionMessage appearance="success" title={published.created ? 'Report page created' : `Report updated to version ${published.version}`}>
          {published.url ? <Link href={published.url} openNewTab>{published.title}</Link> : <Text>{published.title}</Text>}
        </SectionMessage>
      )}
    </Stack>
  );
};

const App = () => {
  const [o, setO] = useState<Overview>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    call<Overview>('overview').then(setO, (e) => setError(String(e)));
  }, []);
  if (error) return <SectionMessage appearance="error">{error}</SectionMessage>;
  if (!o) return <Spinner />;
  return (
    <Stack space="space.200">
      {o.configErrors.length > 0 && (
        <SectionMessage appearance="warning" title="Some Tracewell settings were ignored">
          {o.configErrors.map((e) => (
            <Text key={e}>{e}</Text>
          ))}
        </SectionMessage>
      )}
      <Tabs id="tracewell-tabs">
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Trace matrix</Tab>
          <Tab>{`Risk (${o.risks.length})`}</Tab>
          <Tab>Release</Tab>
        </TabList>
        <TabPanel>
          <Summary o={o} />
        </TabPanel>
        <TabPanel>
          <Matrix o={o} />
        </TabPanel>
        <TabPanel>
          <Risks o={o} />
        </TabPanel>
        <TabPanel>
          <Release o={o} />
        </TabPanel>
      </Tabs>
    </Stack>
  );
};

ForgeReconciler.render(<App />);
