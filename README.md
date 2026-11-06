# HCIP VRP 命令行训练场

一个纯前端的华为 HCIP-Datacom 学习工具：eNSP 风格的命令行输入体验 + 快速记笔记。
单文件、零依赖、离线可用，双击 `index.html` 就能跑。

## 功能

- **CLI 输入**：Tab 补全（唯一候选直接补全，多候选原位轮换）、`?` 帮助、`↑ ↓` 历史、`q` 退视图
- **视图跳转**：`interface` / `vlan` 在任意视图可用，`quit` 逐级返回
- **命令库**：567 条命令 / 33 个视图，覆盖 HCIP-Datacom 考纲 62 个考点
- **参数标注**：关键字 / 接口名 / IP / 子网掩码 / 反掩码 / 枚举分色显示，掩码与反掩码双向纠错
- **缩写识别**：`int g 0/0/1` → `interface GigabitEthernet0/0/1`；有歧义时直接列出候选
- **快速笔记**：单击记当前命令；在终端里左键框选多行，可一次记下全部（含精确注释）
- **导出**：一键导出 Markdown

## 使用

用浏览器打开 `index.html` 即可，笔记存在浏览器 localStorage 里。

```text
[Huawei] interface LoopBack0
// 进入环回接口0的配置视图

[Huawei-LoopBack0] ip address 10.0.0.1 255.255.255.0
// 给接口配IP地址10.0.0.1/24（掩码 255.255.255.0）
```

## 脚本

```bash
node test.js     # 引擎断言（87 条）
node exam.js     # HCIP-Datacom 考纲对照（62 个考点）
node audit.js    # 功能域覆盖体检（27 个功能域）
```

## 说明

- 命令库以 HCIP-Datacom 考纲和常用排错命令为主，**不是 eNSP 全量 VRP**（完整手册约 5000+ 条）。
- 所有回显都是学习用途的本地模拟，不连接真实设备，也不需要 eNSP。
- 命令树采用「一行一条语法」的 SPEC 格式，新增命令只需加一行，引擎不用改。
