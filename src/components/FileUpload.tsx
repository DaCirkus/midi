'use client';

import { useCallback, useState } from 'react';
import { Group, Text, rem, Progress, Alert } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconUpload, IconX, IconMusic, IconAlertCircle } from '@tabler/icons-react';

export function FileUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    setFiles(acceptedFiles);
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Get presigned URL
      const res = await fetch('/api/upload-url');
      const { url, fields } = await res.json();

      // Create form data with presigned fields
      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      formData.append('file', acceptedFiles[0]);

      // Upload to S3
      const uploadRes = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }

      // Start processing
      const processRes = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: acceptedFiles[0].name,
        }),
      });

      const data = await processRes.json();
      setUploadProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, []);

  return (
    <>
      <Dropzone
        onDrop={handleDrop}
        accept={['audio/mpeg']}
        maxSize={30 * 1024 * 1024}
        disabled={isUploading}
      >
        <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-blue-6)' }}
              stroke={1.5}
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-red-6)' }}
              stroke={1.5}
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconMusic
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-dimmed)' }}
              stroke={1.5}
            />
          </Dropzone.Idle>

          <div>
            <Text size="xl" inline>
              {isUploading ? 'Uploading...' : 'Drag MP3 files here or click to select'}
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Files should not exceed 30MB
            </Text>
            {files.length > 0 && (
              <Text size="sm" mt={10}>
                Selected files: {files.map(file => file.name).join(', ')}
              </Text>
            )}
          </div>
        </Group>
      </Dropzone>

      {isUploading && (
        <Progress
          value={uploadProgress}
          size="xl"
          radius="xl"
          mt="md"
          animated
          striped
        />
      )}

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mt="md">
          {error}
        </Alert>
      )}
    </>
  );
} 