# Ralph Failures

- Initial audit script falsely flagged shebang-based JS files as missing CRITICAL markers.
  - Fix: marker detection now accepts marker on line 2 when line 1 is a shebang.
