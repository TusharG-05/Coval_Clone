"use client";
import { useState, useEffect, useRef } from "react";
import { Database, Plus, X, Wand2, Loader2, Upload } from "lucide-react";
import Papa from "papaparse";

interface TestCase {
  scenario: string;
  expected_outcome: string;
}

interface TestSet {
  id: string;
  name: string;
  description: string;
  test_cases: TestCase[];
  created_at: string;
}

export default function TestSetsPage() {
  const [testSets, setTestSets] = useState<TestSet[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [testCases, setTestCases] = useState<TestCase[]>([{ scenario: "", expected_outcome: "" }]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTestSets();
  }, []);

  const fetchTestSets = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/test-sets");
      const data = await res.json();
      setTestSets(data);
    } catch (error) {
      console.error("Failed to fetch test sets:", error);
    }
  };

  const handleTestCaseChange = (index: number, field: keyof TestCase, value: string) => {
    const newCases = [...testCases];
    newCases[index][field] = value;
    setTestCases(newCases);
  };

  const removeTestCase = (index: number) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const res = await fetch("http://localhost:8000/api/test-sets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiPrompt })
      });
      const data = await res.json();
      if (data.test_cases) {
        setTestCases([...testCases.filter(tc => tc.scenario || tc.expected_outcome), ...data.test_cases]);
        setAiPrompt("");
      }
    } catch (error) {
      console.error("Failed to generate test cases:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedCases: TestCase[] = results.data
          .map((row: any) => ({
            scenario: row.scenario || row.Scenario || "",
            expected_outcome: row.expected_outcome || row["Expected Outcome"] || row.expectedOutcome || ""
          }))
          .filter(tc => tc.scenario); // Only keep rows that have a scenario

        if (parsedCases.length > 0) {
          setTestCases([...testCases.filter(tc => tc.scenario || tc.expected_outcome), ...parsedCases]);
        } else {
          alert("Could not find 'scenario' and 'expected_outcome' columns in CSV.");
        }
        
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        alert("Failed to parse CSV file.");
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...formData, test_cases: testCases.filter(tc => tc.scenario) };
      const res = await fetch("http://localhost:8000/api/test-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setIsFormOpen(false);
        setFormData({ name: "", description: "" });
        setTestCases([{ scenario: "", expected_outcome: "" }]);
        fetchTestSets();
      }
    } catch (error) {
      console.error("Failed to create test set:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="h-6 w-6 text-emerald-500" />
            Test Sets
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">A collection of test cases that tell the simulated user what to do.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Test Set
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Test Set</h2>
            <button onClick={() => setIsFormOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Test Set Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input 
                  required
                  type="text" 
                  placeholder="e.g. Edge cases for refunds"
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
            </div>
            
            <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-4 gap-4 w-full">
                <h3 className="text-md font-semibold text-gray-900 dark:text-white whitespace-nowrap">Test Cases</h3>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto">
                  {/* CSV Upload */}
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      title="Upload CSV"
                    />
                    <button type="button" className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors">
                      <Upload className="w-4 h-4" />
                      Import CSV
                    </button>
                  </div>

                  {/* AI Generation Tools */}
                  <div className="flex items-center flex-1 sm:max-w-md w-full">
                    <input 
                      placeholder="Generate with AI..."
                      className="flex-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-l-lg p-2 text-sm text-gray-900 dark:text-white outline-none focus:border-purple-500 min-w-0"
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGenerateAI())}
                    />
                    <button 
                      type="button"
                      onClick={handleGenerateAI}
                      disabled={isGenerating || !aiPrompt}
                      className="flex items-center justify-center p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300 rounded-r-lg text-sm transition-colors disabled:opacity-50"
                      title="Auto-Generate"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {testCases.map((tc, idx) => (
                  <div key={idx} className="flex gap-3 group">
                    <div className="flex-1 space-y-1">
                      <label className="block text-xs font-medium text-gray-500">Scenario</label>
                      <input 
                        required={idx === 0}
                        placeholder="e.g. Ask for a refund for a delayed flight"
                        className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                        value={tc.scenario}
                        onChange={(e) => handleTestCaseChange(idx, "scenario", e.target.value)}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="block text-xs font-medium text-gray-500">Expected Outcome</label>
                      <input 
                        required={idx === 0}
                        placeholder="e.g. Agent denies the refund but offers miles"
                        className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                        value={tc.expected_outcome}
                        onChange={(e) => handleTestCaseChange(idx, "expected_outcome", e.target.value)}
                      />
                    </div>
                    {testCases.length > 1 && (
                      <div className="flex items-end pb-1.5">
                        <button 
                          type="button" 
                          onClick={() => removeTestCase(idx)}
                          className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <button 
                type="button" 
                onClick={() => setTestCases([...testCases, { scenario: "", expected_outcome: "" }])}
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 text-sm font-medium mt-4 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add empty row
              </button>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-800">
              <button type="submit" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors">
                Save Test Set
              </button>
            </div>
          </form>
        </div>
      )}

      {testSets.length === 0 && !isFormOpen ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No test sets yet</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-6">Create your first test set to define conversation scenarios and expected behaviors for your agents.</p>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Test Set
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {testSets.map((testSet) => (
            <div key={testSet.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm hover:border-emerald-200 dark:hover:border-gray-700 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-xl">{testSet.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{testSet.description}</p>
                </div>
                <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-semibold px-3 py-1 rounded-full">
                  {testSet.test_cases.length} Cases
                </span>
              </div>
              
              <div className="space-y-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800/50 max-h-64 overflow-y-auto">
                {testSet.test_cases.map((tc, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-950/50 p-3 rounded-lg text-sm border border-gray-100 dark:border-gray-800/50">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold block mb-1">Scenario</span> 
                        <span className="text-gray-900 dark:text-gray-300">{tc.scenario}</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold block mb-1">Expected Outcome</span> 
                        <span className="text-gray-600 dark:text-gray-400">{tc.expected_outcome}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
