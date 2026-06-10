// vitest 专用空模块:替身 "server-only" 包。
// 真包在非 react-server 环境 import 即 throw(这正是它在 build 期的护栏价值),
// 但 jsdom 测试环境也会中招——alias 到这个空模块让 server-api 等服务端模块可测。
export {}
