export default function ChatWidget() {
  return (
    <button
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center z-50"
      onClick={() => alert('Chat widget test')}
    >
      💬
    </button>
  );
}
```
