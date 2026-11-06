// HCIP-Datacom 考点对照：每个考点列出「必须存在的命令」或「必须能解析的实命令」
const fs = require('fs');
const h = fs.readFileSync('D:/huaweinet/hcip-lab/index.html', 'utf8');
const core = /<script id="vrp-core">([\s\S]*?)<\/script>/.exec(h)[1];
const VRP = new Function(core + ';return VRP;')();
const lib = VRP.enumerate();
const has = (s) => lib.some(x => x.syntax.toLowerCase().includes(s.toLowerCase()));
// 真跑一次解析，验证「能敲出来」而不只是「字面存在」
const runs = (view, cmd) => { const r = VRP.analyze(view, cmd); return !r.err && !!r.action; };

const PLAN = [
  ['OSPF', [
    ['邻居 / 网络类型', ['ospf network-type', 'ospf timer hello', 'ospf timer dead']],
    ['接口与区域认证', ['ospf authentication-mode md5', 'authentication-mode']],
    ['DR 选举', ['ospf dr-priority']],
    ['接口开销', ['ospf cost']],
    ['LSA 查看（1/2/3/4/5/7）', ['display ospf lsdb router', 'display ospf lsdb network', 'display ospf lsdb summary', 'display ospf lsdb asbr', 'display ospf lsdb ase', 'display ospf lsdb nssa']],
    ['特殊区域 Stub / NSSA', ['stub', 'nssa']],
    ['完全特殊区域', ['stub no-summary', 'nssa no-summary']],
    ['区域/ASBR 汇总', ['abr-summary', 'asbr-summary']],
    ['虚连接', ['vlink-peer']],
    ['引入路由 / 默认路由', ['import-route', 'default-route-advertise']],
    ['静默接口', ['silent-interface']],
    ['路由过滤', ['filter-policy']]
  ]],
  ['IS-IS', [
    ['NET 与级别', ['network-entity', 'is-level']],
    ['开销类型', ['cost-style']],
    ['路由泄漏 L1→L2', [], () => runs('isis', 'import-route isis level-1 into level-2')],
    ['路由聚合', ['summary']],
    ['接口级别 / 开销', ['isis circuit-level', 'isis cost']],
    ['认证', ['isis authentication-mode']]
  ]],
  ['BGP', [
    ['邻居建立', ['peer', 'as-number', 'connect-interface', 'ebgp-max-hop']],
    ['路由反射', ['reflect-client', 'route-reflector-client']],
    ['联盟', ['confederation id', 'confederation peer-as']],
    ['路由聚合', ['aggregate']],
    ['选路属性', ['default local-preference', 'default med', 'preferred-value', 'apply as-path', 'apply community']],
    ['路由过滤', ['filter-policy', 'as-path-filter', 'ip-prefix']],
    ['团体属性', ['community-filter']],
    ['下一跳控制', ['next-hop-local']]
  ]],
  ['路由控制', [
    ['前缀列表 + 掩码范围', ['greater-equal', 'less-equal']],
    ['Route-Policy', ['route-policy', 'if-match', 'apply']],
    ['策略路由 PBR', ['policy-based-route']]
  ]],
  ['MPLS / VPN', [
    ['MPLS 基础', ['mpls lsr-id', 'mpls ldp', 'lsp-trigger']],
    ['VPN 实例 / RD / RT', ['ip vpn-instance', 'route-distinguisher', 'vpn-target']],
    ['接口绑定 VPN', ['ip binding vpn-instance']],
    ['VPNv4 地址族', ['ipv4-family vpnv4', 'policy vpn-target']],
    ['LSP 查看', ['display mpls lsp', 'display mpls ldp session']]
  ]],
  ['组播', [
    ['组播路由 / PIM', ['multicast routing-enable', 'pim sm', 'pim dm']],
    ['IGMP', ['igmp version', 'igmp static-group']],
    ['RP 配置', ['static-rp', 'c-bsr', 'c-rp']],
    ['IGMP Snooping', ['igmp-snooping enable']],
    ['MSDP', ['msdp', 'peer']]
  ]],
  ['IPv6', [
    ['基础使能 / 地址', ['ipv6', 'ipv6 address', 'ipv6 enable']],
    ['ND / RA', ['ipv6 nd']],
    ['OSPFv3', ['ospfv3']],
    ['BGP IPv6', ['ipv6-family unicast']],
    ['DHCPv6', ['dhcpv6 pool']]
  ]],
  ['安全', [
    ['ACL（含反掩码匹配）', ['acl', 'rule'], () => runs('acl', 'rule 5 permit source 192.168.1.0 0.0.0.255')],
    ['端口安全', ['port-security enable', 'port-security max-mac-num']],
    ['DHCP Snooping', ['dhcp snooping enable', 'dhcp snooping trusted']],
    ['IPSG / uRPF', ['ip source check user-bind', 'urpf']],
    ['AAA / RADIUS', ['aaa', 'local-user', 'radius-server template']]
  ]],
  ['可靠性', [
    ['VRRP', ['vrrp vrid', 'virtual-ip', 'priority']],
    ['BFD', ['bfd']],
    ['链路聚合（LACP）', ['eth-trunk', 'trunkport'], () => runs('ethTrunk', 'mode lacp-static')],
    ['Smart Link / RRPP', ['smart-link group', 'rrpp domain']]
  ]],
  ['QoS', [
    ['分类-行为-策略', ['traffic classifier', 'traffic behavior', 'traffic policy']],
    ['限速 / 队列', ['qos car', 'car cir', 'wrr weight']]
  ]],
  ['二层 / 三层', [
    ['VLAN / Trunk / Hybrid', ['vlan', 'port link-type', 'port trunk allow-pass vlan', 'port default vlan', 'port hybrid']],
    ['STP / MSTP', ['stp mode', 'stp root primary', 'stp region-configuration', 'instance']],
    ['静态路由', ['ip route-static']],
    ['VLANIF 三层接口', [], () => runs('system', 'interface Vlanif 10')]
  ]],
  ['运维 / 排错', [
    ['配置保存与启动', ['save', 'startup saved-configuration']],
    ['排错查询', ['display ospf error', 'display bgp routing-table', 'display ip routing-table']],
    ['调试', ['debugging', 'undo debugging all']]
  ]]
];

let total = 0, pass = 0;
const rows = [];
PLAN.forEach(([dom, items]) => {
  let dp = 0;
  const miss = [];
  items.forEach(([name, cmds, fn]) => {
    total++;
    const absent = cmds.filter(c => !has(c));
    const fnOk = fn ? fn() : true;
    if (absent.length === 0 && fnOk) { pass++; dp++; }
    else miss.push(name + (absent.length ? '（缺 ' + absent.join('、') + '）' : '（规则可解析失败）'));
  });
  rows.push({ dom, done: dp, all: items.length, miss });
});

console.log('命令库：' + lib.length + ' 条 / ' + Object.keys(VRP.VIEWS).length + ' 个视图');
console.log('考点覆盖：' + pass + '/' + total + '  （' + Math.round(pass / total * 100) + '%）\n');
rows.forEach(r => {
  console.log(r.dom.padEnd(14) + '█'.repeat(r.done) + '░'.repeat(r.all - r.done) + '  ' + r.done + '/' + r.all);
  r.miss.forEach(m => console.log('    ✗ ' + m));
});
