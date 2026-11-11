import { useEffect, useState } from 'react';
import ForgeReconciler, { Button, CodeBlock, Heading, SectionMessage, Spinner, Stack, Text, TextArea } from '@forge/react';
import { call } from './call';

type Settings = { text: string; errors: string[]; defaults: string };
type Saved = { saved: boolean; errors: string[] };

const EXAMPLE = `{
  "issueTypes": { "Software Requirement": "designInput", "Test": "verification" },
  "linkTypes": ["Relates", "Tests"],
  "required": { "designInput": ["verification"] }
}`;

const App = () => {
  const [s, setS] = useState<Settings>();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<Saved>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    call<Settings>('getSettings').then((r) => {
      setS(r);
      setText(r.text);
    });
  }, []);
  if (!s) return <Spinner />;
  const save = () => {
    setBusy(true);
    call<Saved>('saveSettings', { text })
      .then(setSaved, (e) => setSaved({ saved: false, errors: [String(e)] }))
      .finally(() => setBusy(false));
  };
  return (
    <Stack space="space.200">
      <Heading size="medium">Tracewell settings</Heading>
      <Text>
        Map your issue types, labels and link types onto design-control kinds, and choose which trace links are required. Leave
        empty to use the defaults. Kinds: userNeed, designInput, designOutput, verification, validation, hazard, riskControl.
      </Text>
      {s.errors.map((e) => (
        <SectionMessage key={e} appearance="warning">
          {e}
        </SectionMessage>
      ))}
      <TextArea name="config" defaultValue={s.text} placeholder={EXAMPLE} minimumRows={10} onChange={(e) => setText(e.target.value)} />
      <Button appearance="primary" isDisabled={busy} onClick={save}>
        Save settings
      </Button>
      {saved?.saved && <SectionMessage appearance="success">Saved. Tracewell uses these settings for this project.</SectionMessage>}
      {saved && !saved.saved && (
        <SectionMessage appearance="error" title="Not saved">
          {saved.errors.map((e) => (
            <Text key={e}>{e}</Text>
          ))}
        </SectionMessage>
      )}
      <Heading size="small">Defaults</Heading>
      <CodeBlock language="json" text={s.defaults} />
    </Stack>
  );
};

ForgeReconciler.render(<App />);
