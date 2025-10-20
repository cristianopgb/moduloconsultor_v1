// /src/components/Sidebar/index.tsx
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className="bg-gray-900 text-gray-300 border-r border-gray-800 w-12 flex-col hidden md:flex">
      <button onClick={onToggle} className="p-3 hover:bg-gray-800" title="Alternar lista">
        ≡
      </button>
    </div>
  );
}
