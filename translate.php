<?php

function writeToFile(array $list): bool
{
    foreach ($list as $item) {
        $jsonContent = json_encode($item['data'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if (file_put_contents($item['file'], $jsonContent) === false) {
            return false;
        }
    }
    return true;
}

function process(): bool
{
    $filePath = 'translate.json';
    if (!is_file($filePath)) {
        echo ("translate.json file not found" . PHP_EOL);
        return false;
    }

    $content = file_get_contents($filePath);
    $data = json_decode($content, true);

    if (!isset($data['name'])) {
        echo ("translate.json is missing \"name\" field" . PHP_EOL);
        return false;
    }

    echo ("Adding \"{$data['name']}\" to translations" . PHP_EOL);

    print_r($data);

    if (!isset($data['result'])) {
        echo ("translate.json is missing \"result\" field" . PHP_EOL);
        return false;
    }

    $data['name'] = str_replace(' ', '_', $data['name']);
    $map = $data['result'];

    if (count(array_keys($map)) !== 21) {
        echo ("translate.json should have exactly 21 keys in \"result\"" . PHP_EOL);
        return false;
    }

    $dirPath = 'src/locales';
    if (!is_dir($dirPath)) {
        echo ("Directory locales does not exist" . PHP_EOL);
        return false;
    }

    $targetDataList = [];
    $dir = opendir($dirPath);

    while (($file = readdir($dir)) !== false) {
        $filePath = $dirPath . '/' . $file;
        if (is_file($filePath) && pathinfo($filePath, PATHINFO_EXTENSION) === 'json') {
            $content = file_get_contents($filePath);
            $targetData = json_decode($content, true);

            $normalizedPath = str_replace('\\', '/', $filePath);
            $fileName = pathinfo($normalizedPath, PATHINFO_FILENAME);

            if (isset($targetData[$data['name']])) {
                echo ("translate.json already has \"{$data['name']}\" key in $normalizedPath" . PHP_EOL);
                closedir($dir);
                return false;
            }

            if (isset($map[$fileName])) {
                $targetData[$data['name']] = $map[$fileName];
                $targetDataList[] = [
                    'file' => $normalizedPath,
                    'data' => $targetData
                ];
            } else {
                echo ("translate.json does not have \"{$data['name']}\" key for $filePath" . PHP_EOL);
                closedir($dir);
                return false;
            }
        }
    }
    closedir($dir);

    $result = writeToFile($targetDataList);

    if (!$result) {
        echo ("Failed to write translations to files." . PHP_EOL);
        return false;
    }

    echo ("Translations updated successfully." . PHP_EOL);
    return true;
}

function remove(string $name): bool
{
    $dirPath = 'src/locales';
    if (!is_dir($dirPath)) {
        echo ("Directory locales does not exist" . PHP_EOL);
        return false;
    }

    $targetDataList = [];
    $dir = opendir($dirPath);

    while (($file = readdir($dir)) !== false) {
        $filePath = $dirPath . '/' . $file;
        if (is_file($filePath) && pathinfo($filePath, PATHINFO_EXTENSION) === 'json') {
            $content = file_get_contents($filePath);
            $targetData = json_decode($content, true);

            if (!isset($targetData[$name])) {
                echo ("translate.json does not have \"$name\" key in $filePath" . PHP_EOL);
                closedir($dir);
                return false;
            }

            unset($targetData[$name]);
            $targetDataList[] = [
                'file' => $filePath,
                'data' => $targetData
            ];
        }
    }
    closedir($dir);

    $result = writeToFile($targetDataList);

    if (!$result) {
        echo ("Failed to write translations to files." . PHP_EOL);
        return false;
    }

    echo ("Removed \"$name\" from \"locales\" successfully." . PHP_EOL);
    return true;
}

if (!empty($argv[1]) && $argv[1] === 'remove' && !empty($argv[2])) {
    remove($argv[2]);
} else {
    process();
}
