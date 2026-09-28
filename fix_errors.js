const fs = require('fs');
const path = require('path');

const filesToSwap = [
  'src/app/conversations/page.tsx',
  'src/app/review/page.tsx',
  'src/app/schedules/page.tsx',
  'src/app/simulate/page.tsx',
  'src/app/traces/page.tsx'
];

for (const file of filesToSwap) {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Extract useEffect block
  const useEffRegex = /  useEffect\(\(\) => \{[\s\S]*?\}, \[fetchData\]\);\n\n/m;
  const match = content.match(useEffRegex);
  
  if (match) {
    const useEffBlock = match[0];
    content = content.replace(useEffRegex, '');
    
    // Find the end of fetchData block
    const fetchDataRegex = /  const fetchData = useCallback\(async \(\) => \{[\s\S]*?\}, \[\]\);\n/m;
    
    content = content.replace(fetchDataRegex, (fetchMatch) => {
      return fetchMatch + '\n' + useEffBlock;
    });
    
    fs.writeFileSync(filePath, content);
  }
}

// Fix agents/page.tsx
let agents = fs.readFileSync('src/app/agents/page.tsx', 'utf8');
agents = agents.replace(/formData\.connection_config\.([\w_]+) \|\| ""/g, '(formData.connection_config.$1 as string) || ""');
agents = agents.replace(/agent\.connection_config\.([\w_]+)/g, '(agent.connection_config.$1 as string)');
agents = agents.replace(/String\(\(agent\.connection_config\.system_prompt as string\)\)/g, 'String(agent.connection_config.system_prompt)');
fs.writeFileSync('src/app/agents/page.tsx', agents);

// Fix test-sets/page.tsx
let testSets = fs.readFileSync('src/app/test-sets/page.tsx', 'utf8');
testSets = testSets.replace(/\.map\(\(row: Record<string, string>\) => \(\{/g, '.map((row: any) => ({');
fs.writeFileSync('src/app/test-sets/page.tsx', testSets);

console.log("Fixes applied");
