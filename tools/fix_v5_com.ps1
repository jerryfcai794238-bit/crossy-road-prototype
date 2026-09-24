$ErrorActionPreference='Stop'
$out=(Resolve-Path 'docs\presentation\小鳥過馬路_Traffic Bird_提案簡報v5.pptx').Path
$asset=(Resolve-Path 'docs\presentation\.v5-build-assets').Path
function box($s,$x,$y,$w,$h,$c=16777215){$q=$s.Shapes.AddShape(5,$x,$y,$w,$h);$q.Fill.ForeColor.RGB=$c;$q.Line.ForeColor.RGB=14540253;return $q}
function txt($s,$t,$x,$y,$w,$h,$size=16){$q=$s.Shapes.AddTextbox(1,$x,$y,$w,$h);$q.TextFrame.TextRange.Text=$t;$q.TextFrame.TextRange.Font.NameFarEast='Noto Sans TC';$q.TextFrame.TextRange.Font.Size=$size;$q.TextFrame.WordWrap=-1;return $q}
function clear($s){for($i=$s.Shapes.Count;$i -ge 1;$i--){$s.Shapes.Item($i).Delete()}}
function head($s,$n,$title){box $s 0 0 960 540 16382972|Out-Null;box $s 0 520 960 20 13735729|Out-Null;txt $s $title 52 34 700 36 25|Out-Null;txt $s $n 875 35 28 25 15|Out-Null;txt $s 'Traffic Bird｜多人派對玩法提案' 52 523 300 10 8|Out-Null}
$a=New-Object -ComObject PowerPoint.Application;$a.Visible=-1;$p=$a.Presentations.Open($out,$false,$false,$true)
# 5
$s=$p.Slides.Item(5);clear $s;head $s '5' '三大玩法擴充'
$data=@(@('① 體力策略','每次移動消耗體力，停留後恢復','體力消耗.png'),@('② 動態場景','坑洞、斷橋與高速車輛改變安全路線','動態地形.png'),@('③ 互動道具','問號箱提供攻擊、保護與追趕','問號箱.png'));$xs=@(52,320,588)
for($i=0;$i -lt 3;$i++){$x=$xs[$i];box $s $x 120 247 320|Out-Null;$s.Shapes.AddPicture((Join-Path $asset $data[$i][2]),0,-1,($x+14),138,219,120)|Out-Null;txt $s $data[$i][0] ($x+15) 277 210 22 15|Out-Null;txt $s $data[$i][1] ($x+15) 310 210 52 11|Out-Null;txt $s '展示素材' ($x+160) 246 66 10 8|Out-Null};$b=box $s 52 465 856 35 13735729;txt $s '體力製造決策 ＋ 動態場景製造變化 ＋ 道具製造玩家互動' 80 472 800 18 14|Out-Null
# 6
$s=$p.Slides.Item(6);clear $s;head $s '6' '遊玩情境｜讓每一段過程都有意外發生'
$data=@(@('撞車','被車撞到｜下一秒整隻飛出去','BAM!'),@('落水','掉進河裡｜差一步就過去了','GURGLE!'),@('命中','被道具打中｜領先到一半突然失控','DIZZY!'),@('踩坑','踩到坑洞｜看到了，卻已經來不及','!!'));$xs=@(52,268,484,700)
for($i=0;$i -lt 4;$i++){$x=$xs[$i];box $s $x 130 197 300|Out-Null;$v=box $s ($x+14) 147 169 94 15132390;txt $s '概念示意' ($x+55) 181 90 18 13|Out-Null;txt $s $data[$i][0] ($x+14) 260 160 18 14|Out-Null;txt $s $data[$i][1] ($x+14) 292 160 45 10|Out-Null;txt $s $data[$i][2] ($x+14) 394 100 14 11|Out-Null};$b=box $s 52 465 856 35 13735729;txt $s '不只自己玩得有反應，旁邊的人也看得懂發生了什麼。' 145 472 680 18 14|Out-Null
# 7
$s=$p.Slides.Item(7);clear $s;head $s '7' '遊戲風格｜歐美積木玩具風'
foreach($d in @(@(52,'橫版遊戲畫面'),@(500,'直版遊戲畫面'))){$x=$d[0];box $s $x 120 408 295|Out-Null;txt $s $d[1] ($x+18) 140 180 18 14|Out-Null;$v=box $s ($x+18) 171 372 185 15132390;txt $s '積木小鳥／車輛／道路／多名玩家同場' ($x+40) 247 320 20 12|Out-Null;txt $s '概念示意' ($x+280) 332 80 10 8|Out-Null};$labels=@('積木玩具','歐美卡通','清楚易讀','誇張反饋');for($i=0;$i -lt 4;$i++){box $s (80+200*$i) 425 178 28 13735729|Out-Null;txt $s $labels[$i] (95+200*$i) 431 145 15 11|Out-Null};$b=box $s 52 465 856 35 13735729;txt $s '看起來可愛，玩起來混亂。' 320 472 320 18 14|Out-Null
$p.Save();$p.Close();$a.Quit()
