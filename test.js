const fs = require('fs');
const path = 'D:/huaweinet/hcip-lab/index.html';
const html = fs.readFileSync(path, 'utf8');

function extract(id) {
  const re = new RegExp('<script id="' + id + '">([\\s\\S]*?)<\\/script>');
  const m = re.exec(html);
  if (!m) throw new Error('block not found: ' + id);
  return m[1];
}

const core = extract('vrp-core');
const ui = extract('vrp-ui');

new Function(core);
console.log('[OK] core syntax');
try { new Function(ui); console.log('[OK] ui syntax'); }
catch (e) { console.log('[FAIL] ui syntax: ' + e.message); }

const VRP = new Function(core + '\n;return VRP;')();

let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); }
}

console.log('\n--- 接口地址：两层结构 ---');
let r = VRP.analyze('system', 'int g 0/0/0');
t('int g 0/0/0 解析成功', !r.err, r.err && r.err.msg);
t('进入接口视图', r.action && r.action.view === 'if', JSON.stringify(r.action));
t('接口名规范化', r.path[1] && r.path[1].display === 'GigabitEthernet0/0/0', r.path[1] && r.path[1].display);

r = VRP.analyze('if', 'ip add 192.168.1.1 255.255.255.0');
t('ip add 双参数解析', !r.err && r.path.length === 4, r.err && r.err.msg);
t('参数1 = ipv4 / 接口IP地址', r.path[2].node.param === 'ipv4' && r.path[2].node.role === '接口IP地址');
t('参数2 = mask / 子网掩码', r.path[3].node.param === 'mask' && r.path[3].node.role === '子网掩码');
t('掩码提示含反掩码', /0\.0\.0\.255/.test(r.path[3].note), r.path[3].note);

console.log('\n--- 掩码 / 反掩码 双向纠错 ---');
r = VRP.analyze('if', 'ip add 192.168.1.1 0.0.0.255');
t('掩码位填反掩码 -> 报错', !!r.err);
t('提示应为 255.255.255.0', r.err && /反掩码/.test(r.err.detail) && /255\.255\.255\.0/.test(r.err.hint),
  r.err && (r.err.detail + ' | ' + r.err.hint));
t('错误行用 VRP 原话', r.err && r.err.msg === "Wrong parameter found at '^' position.", r.err && r.err.msg);

r = VRP.analyze('ospfArea', 'network 192.168.1.0 0.0.0.255');
t('OSPF network 反掩码通过', !r.err, r.err && r.err.msg);
t('给出等价子网掩码', r.path[2] && /255\.255\.255\.0/.test(r.path[2].note), r.path[2] && r.path[2].note);

r = VRP.analyze('ospfArea', 'network 192.168.1.0 255.255.255.0');
t('OSPF network 填掩码 -> 报错', !!r.err);
t('提示改成 0.0.0.255', r.err && /0\.0\.0\.255/.test(r.err.hint), r.err && r.err.hint);

r = VRP.analyze('ospfArea', 'network 192.168.1.0 0.0.255.0');
t('非互补反掩码 -> 报错', !!r.err);

console.log('\n--- 下一跳 / 网关 / 目的网段 ---');
r = VRP.analyze('system', 'ip route-static 0.0.0.0 0.0.0.0 192.168.1.1');
t('默认路由解析', !r.err, r.err && r.err.msg);
const roles = r.path.filter(p => p.kind === 'param').map(p => p.node.role);
t('角色 = 目的网段/子网掩码/下一跳IP', roles.join(',') === '目的网段,子网掩码,下一跳IP', roles.join(','));

r = VRP.analyze('system', 'ip route-static 192.168.2.0 24 10.0.0.2');
t('前缀长度 24 可作掩码', !r.err, r.err && r.err.msg);
t('24 规范化为 255.255.255.0', r.path[3].display === '255.255.255.0', r.path[3].display);

r = VRP.analyze('pool', 'gateway-list 192.168.1.1');
t('网关地址角色', !r.err && r.path[1].node.role === '网关地址', r.err && r.err.msg);

r = VRP.analyze('pool', 'network 192.168.1.0 mask 255.255.255.0');
t('DHCP network 用 mask 关键字', !r.err && r.path[2].node.text === 'mask', r.err && r.err.msg);

console.log('\n--- 新增视图与命令 ---');
r = VRP.analyze('system', 'interface Eth-Trunk 1');
t('Eth-Trunk 进独立视图', r.action && r.action.view === 'if' && r.path[1].display === 'Eth-Trunk1',
  r.path[1] && r.path[1].display);

r = VRP.analyze('system', 'vlan batch 10 20 30');
t('vlan batch 多值解析', !r.err && r.path.length === 5, r.err && r.err.msg);
t('三个 VLAN 都标为 VLAN列表', r.path.slice(2).every(p => p.node.param === 'vlanlist'));

r = VRP.analyze('if', 'port trunk allow-pass vlan 10 to 20');
t('10 to 20 合并为一个范围', !r.err && r.path.length === 5, r.err && r.err.msg);
t('范围值正确', r.path[4] && r.path[4].display === '10to20', r.path[4] && r.path[4].display);

r = VRP.analyze('bgp', 'peer 10.0.0.2 as-number 200');
t('BGP peer as-number', !r.err, r.err && r.err.msg);
t('AS 号角色', r.path[3] && r.path[3].node.role === '对端AS号', r.path[3] && r.path[3].node.role);

r = VRP.analyze('acl', 'rule 5 permit source 192.168.1.0 0.0.0.255');
t('ACL 反掩码通过', !r.err, r.err && r.err.msg);

r = VRP.analyze('ospf', 'area 0');
t('area 0 进区域视图', r.action && r.action.view === 'ospfArea');

r = VRP.analyze('user', 'display ip routing-table protocol static');
t('display 支持 protocol 过滤', !r.err, r.err && r.err.msg);

r = VRP.analyze('if', 'vrrp vrid 1 virtual-ip 192.168.1.1');
t('VRRP 虚拟 IP', !r.err && r.path[4].node.role === '虚拟IP地址', r.err && r.err.msg);

console.log('\n--- Tab 补全 ---');
let s = VRP.suggest('user', 'sys');
t('sys -> system-view', s.kws.length === 1 && s.kws[0].text === 'system-view', s.kws.map(k => k.text).join(','));
s = VRP.suggest('if', 'ip add ');
t('参数位给出 IP地址 提示', s.kws.length === 0 && s.params.length === 1 && s.params[0].label === 'IP地址');
s = VRP.suggest('system', 'ip ');
t('system ip 子命令齐全', ['route-static','pool','ip-prefix','as-path-filter','community-filter','vpn-instance'].every(x => s.kws.some(k => k.text === x)), s.kws.map(k => k.text).join(','));
s = VRP.suggest('system', 'os');
t('os -> ospf / ospfv3 两个候选', s.kws.length === 2, s.kws.map(k => k.text).join(','));
t('ospf 1 精确匹配进 OSPF 视图（不被 ospfv3 干扰）', (() => { const r = VRP.analyze('system','ospf 1'); return !r.err && r.action.view === 'ospf'; })());
s = VRP.suggest('user', 'disp');
t('disp -> 唯一 display', s.kws.length === 1 && s.kws[0].text === 'display', s.kws.map(k => k.text).join(','));
t('公共前缀', VRP.commonPrefix(['save', 'screen-length', 'system-view']) === 's',
  VRP.commonPrefix(['save', 'screen-length', 'system-view']));

console.log('\n--- 大小写不敏感 ---');
[['system','SYSNAME AR1'],['system','Ip Route-Static 1.1.1.0 255.255.255.0 2.2.2.2'],
 ['system','INTERFACE G0/0/1'],['if','IP ADDRESS 1.1.1.1 24'],['system','VLAN 10'],
 ['user','DISPLAY VERSION'],['acl','RULE 5 PERMIT SOURCE 1.1.1.0 0.0.0.255'],
 ['ospfArea','NETWORK 10.0.0.0 0.0.0.255']].forEach(([v, c]) => {
  const r = VRP.analyze(v, c);
  t('全大写也能解析: ' + c, !r.err, r.err && r.err.msg);
});
let su = VRP.suggest('user', 'SYS');
t('大写前缀 SYS 能补全', su.kws.length === 1 && su.kws[0].text === 'system-view', su.kws.map(k => k.text).join(','));
su = VRP.suggest('system', 'IP');
t('大写前缀 IP 命中 ip / ipv6', su.kws.length === 2, su.kws.map(k => k.text).join(','));
su = VRP.suggest('if', 'IP A');
t('混合大小写 IP A 命中 address', su.kws.length === 1 && su.kws[0].text === 'address', su.kws.map(k => k.text).join(','));

console.log('\n--- 参数位补全候选 ---');
const ifNode = VRP.VIEWS.system.nodes.find(n => n.text === 'interface').children[0];
const vals = VRP.paramValues(ifNode);
t('接口名有多个候选样本', vals.length >= 5, vals.join(','));
t('候选含 GigabitEthernet', vals.some(v => /^GigabitEthernet/.test(v)));
const maskNode = (() => { const r = VRP.analyze('if', 'ip address 1.1.1.1 '); return r.cur[0]; })();
t('掩码位有候选样本', VRP.paramValues(maskNode).length >= 2, VRP.paramValues(maskNode).join(','));
const enumNode = (() => { const r = VRP.analyze('if', 'port link-type '); return r.cur[0]; })();
t('枚举参数返回 options 作为候选', VRP.paramValues(enumNode).join(',') === 'access,trunk,hybrid', VRP.paramValues(enumNode).join(','));

console.log('\n--- 缩写识别 → 完整命令 ---');
t('int g 0/0/1 → interface GigabitEthernet0/0/1',
  VRP.canonical(VRP.analyze('system', 'int g 0/0/1')) === 'interface GigabitEthernet0/0/1',
  VRP.canonical(VRP.analyze('system', 'int g 0/0/1')));
t('ip ad 1.1.1.1 24 → 掩码补齐为 255.255.255.0',
  VRP.canonical(VRP.analyze('if', 'ip ad 1.1.1.1 24')) === 'ip address 1.1.1.1 255.255.255.0',
  VRP.canonical(VRP.analyze('if', 'ip ad 1.1.1.1 24')));
t('ip rou 0.0.0.0 0 1.1.1.2 → ip route-static',
  VRP.canonical(VRP.analyze('system', 'ip rou 0.0.0.0 0 1.1.1.2')) === 'ip route-static 0.0.0.0 0.0.0.0 1.1.1.2',
  VRP.canonical(VRP.analyze('system', 'ip rou 0.0.0.0 0 1.1.1.2')));
t('vlan b 10 20 → vlan batch',
  VRP.canonical(VRP.analyze('system', 'vlan b 10 20')) === 'vlan batch 10 20',
  VRP.canonical(VRP.analyze('system', 'vlan b 10 20')));
t('大写缩写 DISPLAY VER → display version',
  VRP.canonical(VRP.analyze('user', 'DISPLAY VER')) === 'display version',
  VRP.canonical(VRP.analyze('user', 'DISPLAY VER')));

const amb = VRP.analyze('system', 'i');
t('歧义命令报错', !!amb.err && amb.err.kind === 'ambiguous');
t('歧义时列出候选', !!amb.err && /有歧义，可能是/.test(amb.err.hint) && amb.err.expect.length > 1,
  amb.err && amb.err.hint);

console.log('\n--- VRP 风格的报错文案 ---');
let ev = VRP.analyze('system', 'i');
t('歧义 → Ambiguous command', ev.err && ev.err.msg === "Ambiguous command found at '^' position.", ev.err && ev.err.msg);
t('歧义带中文说明', ev.err && /多条命令/.test(ev.err.detail), ev.err && ev.err.detail);

ev = VRP.analyze('system', 'foobar');
t('未知命令 → Unrecognized command', ev.err && ev.err.msg === "Unrecognized command found at '^' position.", ev.err && ev.err.msg);
t('未知命令带中文说明', ev.err && /没有这条命令/.test(ev.err.detail), ev.err && ev.err.detail);

ev = VRP.analyze('user', 'save extra');
t('多参数 → Too many parameters', ev.err && ev.err.msg === "Too many parameters found at '^' position.", ev.err && ev.err.msg);
t('多参数的 ^ 指向多余的那个词', ev.err && ev.err.index === 1 && ev.err.token === 'extra', JSON.stringify(ev.err));

ev = VRP.analyze('if', 'ip address 1.1.1.1 255.0.255.0');
t('非法掩码 → Wrong parameter', ev.err && ev.err.msg === "Wrong parameter found at '^' position.", ev.err && ev.err.msg);

console.log('\n--- eNSP 式视图跳转 ---');
t('q 等同于 quit', (() => { const r = VRP.analyze('if', 'q'); return !r.err && r.action && r.action.pop === true; })());
t('qu / qui 也能退', !VRP.analyze('if', 'qu').err);
t('接口视图里直接 int g0/0/2', (() => { const r = VRP.analyze('if', 'int g0/0/2'); return !r.err && r.action.view === 'if'; })());
t('OSPF 视图里直接跳接口', (() => { const r = VRP.analyze('ospf', 'int g0/0/1'); return !r.err && r.action.view === 'if'; })());
t('VLAN 视图里直接 vlan 20', (() => { const r = VRP.analyze('vlan', 'vlan 20'); return !r.err && r.action.view === 'vlan'; })());
t('ACL 视图里跳 Vlanif', (() => { const r = VRP.analyze('acl', 'int vlanif 10'); return !r.err && r.action.view === 'if'; })());
t('用户视图里没有 interface（要先 system-view）', !!VRP.analyze('user', 'interface g0/0/1').err);

console.log('\n--- Router ID / 协议细节 / 管道 ---');
// Router ID：一行式、空格写法、非法值、系统视图提示
r = VRP.analyze('system', 'ospf 1 router-id 1.1.1.1');
t('ospf 1 router-id 一行式', !r.err && r.action.view === 'ospf', r.err && r.err.msg);
r = VRP.analyze('ospf', 'router id 2.2.2.2');
t('router id（空格）等价 router-id', !r.err && VRP.canonical(r) === 'router-id 2.2.2.2',
  r.err ? r.err.msg : VRP.canonical(r));
r = VRP.analyze('bgp', 'router id 3.3.3.3');
t('BGP 也认 router id', !r.err, r.err && r.err.msg);
r = VRP.analyze('ospf', 'router-id 0.0.0.0');
t('0.0.0.0 不能当 Router ID', !!r.err && /Router ID/.test(r.err.detail), r.err && r.err.detail);
r = VRP.analyze('system', 'router id 1.1.1.1');
t('系统视图 router id 给出正确写法提示', !!r.err && /没有全局 router id/.test(r.err.detail),
  r.err && r.err.detail);

// OSPF / BGP / IS-IS 选项
t('OSPF Dead 定时器', !VRP.analyze('ospf', 'timer hello 10 dead 40').err);
t('OSPF 引入路由带 cost/type', !VRP.analyze('ospf', 'import-route direct cost 10 type 1').err);
t('OSPF 虚连接 MD5 认证', !VRP.analyze('ospfArea', 'vlink-peer 3.3.3.3 authentication-mode md5 1 cipher huawei').err);
t('BGP allow-as-loop', !VRP.analyze('bgp', 'peer 10.0.0.2 allow-as-loop 2').err);
t('IS-IS LSP 生成间隔', !VRP.analyze('isis', 'timer lsp-generation 5 50').err);
t('MPLS label advertise', !VRP.analyze('mpls', 'label advertise non-null').err);

// ACL 真实语法：permit 后直接跟协议，没有 protocol 关键字
r = VRP.analyze('acl', 'rule 5 permit tcp source 1.1.1.0 0.0.0.255 destination 2.2.2.0 0.0.0.255 destination-port eq 80');
t('ACL 五元组（无 protocol 关键字）', !r.err, r.err && r.err.detail);
t('ACL 协议 + any', !VRP.analyze('acl', 'rule 20 permit ip source any').err);

// 管道过滤
r = VRP.analyze('user', 'display current-configuration | include ip');
t('管道 | include 可解析', !r.err && r.pipe && r.pipe.mode === 'include' && r.pipe.text === 'ip',
  r.err ? r.err.msg : JSON.stringify(r.pipe));
t('管道命令进笔记时保留', VRP.canonical(r).indexOf('| include ip') > 0, VRP.canonical(r));

// 其他补齐
t('ping -c 选项在前', !VRP.analyze('user', 'ping -c 4 1.1.1.1').err);
t('NAT 地址池出方向', !VRP.analyze('if', 'nat outbound 2000 address-group 1').err);
t('命名 ACL advance', !VRP.analyze('system', 'acl name test advance').err);
t('时区偏移 08:00:00', !VRP.analyze('system', 'clock timezone BJ add 08:00:00').err);
t('display ip interface 指定接口', !VRP.analyze('user', 'display ip interface GigabitEthernet0/0/1').err);

console.log('\n--- 命令库 ---');
const lib = VRP.enumerate();
t('命令条目 > 300', lib.length > 300, String(lib.length));
const views = Object.keys(VRP.VIEWS);
t('视图数 >= 15', views.length >= 15, String(views.length));
t('每个视图都有 display', views.every(v => VRP.VIEWS[v].nodes.some(n => n.text === 'display')),
  views.filter(v => !VRP.VIEWS[v].nodes.some(n => n.text === 'display')).join(','));

// 编译期防御：占位符写法错误会变成 "<xxx:yyy" 这样的假关键字
let badKeys = [];
(function scan(nodes, v) {
  nodes.forEach(n => {
    if (n.type === 'keyword' && /[<>]/.test(n.text)) badKeys.push(v + ':' + n.text);
    if (n.children) scan(n.children, v);
  });
})([].concat.apply([], views.map(v => VRP.VIEWS[v].nodes)), '');
t('没有残缺的占位符关键字', badKeys.length === 0, badKeys.slice(0, 3).join(','));

// 带空格的 role（<vlanid:VLAN ID>）不能被切词切坏
t('vlan 10 进 VLAN 视图', (() => { const r = VRP.analyze('system', 'vlan 10'); return !r.err && r.action.view === 'vlan'; })());
t('port default vlan 10', !VRP.analyze('if', 'port default vlan 10').err);
t('undo vlan 10', !VRP.analyze('system', 'undo vlan 10').err);
t('display vlan 10', !VRP.analyze('user', 'display vlan 10').err);

// NULL0 / Tunnel 这类编号不固定的接口名（曾因正则只有 1 个捕获组而崩）
t('interface NULL0 可解析', !VRP.analyze('system', 'interface NULL0').err);
t('NULL0 规范写法', VRP.analyze('system', 'interface NULL0').path[1].display === 'NULL0',
  VRP.analyze('system', 'interface NULL0').path[1] && VRP.analyze('system', 'interface NULL0').path[1].display);
t('interface Tunnel0/0/1 可解析', !VRP.analyze('system', 'interface Tunnel0/0/1').err);
t('NULL0 作下一跳可解析', !VRP.analyze('system', 'ip route-static 10.9.0.0 24 NULL0').err);

console.log('  条目数: ' + lib.length + '，视图: ' + views.join(' '));
lib.slice(0, 4).forEach(x => console.log('   [' + x.view + '] ' + x.syntax + '   e.g. ' + x.sample));

console.log('\n结果: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
