export const CASE_FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.stl,.obj,.ply,.zip,.rar,.7z,.tar,.gz,.gzip,.tgz,image/jpeg,image/png,image/webp,application/pdf,model/stl,model/obj,model/ply,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/vnd.rar,application/x-7z-compressed,application/gzip,application/x-gzip,application/x-tar,application/octet-stream'

const SUPPORTED_CASE_FILE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'pdf', 'stl', 'obj', 'ply',
  'zip', 'rar', '7z', 'tar', 'gz', 'gzip', 'tgz',
])

export function isSupportedCaseFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return SUPPORTED_CASE_FILE_EXTENSIONS.has(extension)
}

export const CASE_FILE_FORMAT_DESCRIPTION = 'Images, PDFs, STL/OBJ/PLY scans, and ZIP/RAR/7Z/TAR/GZ packages'
