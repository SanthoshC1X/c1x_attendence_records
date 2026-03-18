"""
File watcher — monitors a folder for Excel changes and triggers backend reload.
Uses watchdog library. Runs in a background thread.
"""

import os
import asyncio
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent

# Will be set by main.py at startup
_reload_callback = None   # async coroutine factory: async def reload(path: str)
_loop: asyncio.AbstractEventLoop | None = None

_observer: Observer | None = None
_watch_dir: str | None = None


def set_reload_callback(callback, loop: asyncio.AbstractEventLoop) -> None:
    global _reload_callback, _loop
    _reload_callback = callback
    _loop = loop


class ExcelFileHandler(FileSystemEventHandler):
    def on_modified(self, event: FileSystemEvent) -> None:
        self._handle(event)

    def on_created(self, event: FileSystemEvent) -> None:
        self._handle(event)

    def _handle(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        path = str(event.src_path)
        if not path.endswith(".xlsx"):
            return
        if _reload_callback and _loop and not _loop.is_closed():
            asyncio.run_coroutine_threadsafe(_reload_callback(path), _loop)


def start_watcher(watch_dir: str) -> None:
    global _observer, _watch_dir

    # Stop existing observer if watching a different directory
    if _observer is not None and _watch_dir == watch_dir:
        return  # already watching this dir

    stop_watcher()

    _watch_dir = watch_dir
    os.makedirs(watch_dir, exist_ok=True)

    _observer = Observer()
    _observer.schedule(ExcelFileHandler(), watch_dir, recursive=False)
    t = threading.Thread(target=_observer.start, daemon=True)
    t.start()


def stop_watcher() -> None:
    global _observer
    if _observer is not None:
        try:
            _observer.stop()
            _observer.join(timeout=2)
        except Exception:
            pass
        _observer = None
