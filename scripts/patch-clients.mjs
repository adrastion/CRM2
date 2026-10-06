import fs from 'fs';

const p = 'client/src/pages/Clients.tsx';
let s = fs.readFileSync(p, 'utf8');
const lines = s.split(/\r?\n/);

const startIdx = lines.findIndex((l) => l.includes('{/* Диалог добавления клиента */}'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('{/* Диалог редактирования клиента */}'));
if (startIdx < 0 || endIdx < 0) {
  console.error('markers not found', startIdx, endIdx);
  process.exit(1);
}

const replacement = `      <CreateClientDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onSuccess={fetchClients}
      />`;

lines.splice(startIdx, endIdx - startIdx, replacement);
s = lines.join('\n');

s = s.replace(
  /\n  const handleCreateClient = async \(\): Promise<boolean> => \{[\s\S]*?\n  \};\n\n  \/\/ Validate field in real-time\n/,
  '\n  // Validate field in real-time\n'
);

s = s.replace(
  /\n  const discardCreateForm = React\.useCallback\(\(\) => \{[\s\S]*?\n  \}, \[\]\);\n\n  const discardEditForm/,
  '\n  const discardEditForm'
);

s = s.replace(/\n  const createDirty = openDialog && isDirtyValue\(formData, createFormBaseline\);\n  const editDirty/, '\n  const editDirty');

s = s.replace(
  /\n  const createUnsaved = useUnsavedClose\(\{[\s\S]*?\n  \}\);\n\n  const editUnsaved/,
  '\n  const editUnsaved'
);

s = s.replace(
  /const openAddClientDialog = \(\) => \{[\s\S]*?setOpenDialog\(true\);\n  \};/,
  `const openAddClientDialog = () => {
    setEditingClient(null);
    setOpenDialog(true);
  };`
);

s = s.replace(/\n  const loadUpcomingTrialTrainings = async \(groupId\?: string\) => \{[\s\S]*?\n  \};\n\n  return \(/, '\n  return (');

s = s.replace(
  /\n      <UnsavedChangesDialog\n        open=\{createUnsaved\.confirmOpen\}[\s\S]*?onStay=\{createUnsaved\.stay\}\n      \/>\n/,
  '\n'
);

s = s.replace(
  /\n      \{\/\* Диалог паспорта спортсмена \*\/\}[\s\S]*?\n      \{\/\* Snackbar для показа сообщений о валидации \*\/\}/,
  '\n      {/* Snackbar для показа сообщений о валидации */}'
);

fs.writeFileSync(p, s);
console.log('patched Clients.tsx');
