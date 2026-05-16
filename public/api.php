<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// /tables/{table} 또는 /tables/{table}/{id} 파싱
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (!preg_match('#/tables/([^/?]+)(?:/([^/?]+))?#', $uri, $m)) {
    http_response_code(400);
    echo json_encode(array('error' => '잘못된 요청'));
    exit;
}

$table = $m[1];
$urlId = isset($m[2]) ? $m[2] : null;

if (!in_array($table, array('sessions', 'applications', 'photos'), true)) {
    http_response_code(400);
    echo json_encode(array('error' => '존재하지 않는 테이블'));
    exit;
}

$filePath = __DIR__ . '/data/' . $table . '.json';

function readDb($path) {
    if (!file_exists($path)) return array('data' => array());
    $fp = fopen($path, 'r');
    if (!$fp) return array('data' => array());
    flock($fp, LOCK_SH);
    $json = '';
    while (!feof($fp)) $json .= fread($fp, 65536);
    flock($fp, LOCK_UN);
    fclose($fp);
    $db = json_decode($json, true);
    return (is_array($db) && isset($db['data'])) ? $db : array('data' => array());
}

function writeDb($path, $db) {
    $fp = fopen($path, 'c');
    if (!$fp) return;
    flock($fp, LOCK_EX);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($db, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    flock($fp, LOCK_UN);
    fclose($fp);
}

function newUuid() {
    $b = random_bytes(16);
    $b[6] = chr(ord($b[6]) & 0x0f | 0x40);
    $b[8] = chr(ord($b[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

$method = $_SERVER['REQUEST_METHOD'];

// 가비아 Apache가 application/json POST를 차단하므로
// 프론트엔드는 form-urlencoded + _json 필드로 전송
if (!empty($_POST['_json'])) {
    $body = json_decode($_POST['_json'], true);
} else {
    $body = json_decode(file_get_contents('php://input'), true);
}
if (!is_array($body)) $body = array();

// PATCH/DELETE도 POST로 터널링: _method 필드로 실제 메서드 전달
if ($method === 'POST' && !empty($_POST['_method'])) {
    $method = strtoupper($_POST['_method']);
}

// ID: URL 세그먼트 우선, 없으면 body에서
$id = ($urlId !== null) ? $urlId : (isset($body['id']) ? $body['id'] : null);

switch ($method) {

    case 'GET':
        $db   = readDb($filePath);
        $rows = $db['data'];

        if ($urlId !== null) {
            $found = null;
            foreach ($rows as $row) {
                if (isset($row['id']) && $row['id'] === $urlId) {
                    $found = $row;
                    break;
                }
            }
            if ($found === null) {
                http_response_code(404);
                echo json_encode(array('error' => '항목을 찾을 수 없습니다.'));
            } else {
                echo json_encode($found);
            }
            break;
        }

        $defaultLimit = ($table === 'applications') ? 500 : 200;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : $defaultLimit;
        $rows  = array_slice($rows, 0, $limit);

        if ($table === 'photos') {
            $rows = array_map(function($p) {
                unset($p['photo_data']);
                return $p;
            }, $rows);
        }

        echo json_encode(array('data' => array_values($rows)));
        break;

    case 'POST':
        $db  = readDb($filePath);
        $row = array_merge($body, array(
            'id'         => newUuid(),
            'created_at' => gmdate('Y-m-d\TH:i:s.000\Z'),
        ));
        $db['data'][] = $row;
        writeDb($filePath, $db);
        http_response_code(201);

        if ($table === 'photos') {
            echo json_encode(array(
                'id'             => $row['id'],
                'application_id' => isset($row['application_id']) ? $row['application_id'] : null,
                'created_at'     => $row['created_at'],
            ));
        } else {
            echo json_encode($row);
        }
        break;

    case 'PATCH':
        if (!$id) {
            http_response_code(400);
            echo json_encode(array('error' => 'ID가 필요합니다.'));
            break;
        }
        $db      = readDb($filePath);
        $updated = null;
        foreach ($db['data'] as &$row) {
            if (isset($row['id']) && $row['id'] === $id) {
                $row     = array_merge($row, $body);
                $updated = $row;
                break;
            }
        }
        unset($row);
        if ($updated === null) {
            http_response_code(404);
            echo json_encode(array('error' => '항목을 찾을 수 없습니다.'));
        } else {
            writeDb($filePath, $db);
            echo json_encode($updated);
        }
        break;

    case 'DELETE':
        if (!$id) {
            http_response_code(400);
            echo json_encode(array('error' => 'ID가 필요합니다.'));
            break;
        }
        $db     = readDb($filePath);
        $before = count($db['data']);
        $deleteId = $id;
        $db['data'] = array_values(array_filter($db['data'], function($r) use ($deleteId) {
            return isset($r['id']) && $r['id'] !== $deleteId;
        }));
        if (count($db['data']) === $before) {
            http_response_code(404);
            echo json_encode(array('error' => '항목을 찾을 수 없습니다.'));
        } else {
            writeDb($filePath, $db);
            echo json_encode(array('ok' => true));
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(array('error' => '허용되지 않는 메서드'));
}
