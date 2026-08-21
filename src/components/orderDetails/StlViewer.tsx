'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

interface StlViewerProps {
  url: string
  filename: string
  resetSignal: number
}

export default function StlViewer({ url, filename, resetSignal }: StlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resetViewRef = useRef<(() => void) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    resetViewRef.current?.()
  }, [resetSignal])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    setLoading(true)
    setError(null)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#f5f6fa')

    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 10000)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.setAttribute('aria-label', `Interactive 3D preview of ${filename}`)
    renderer.domElement.dataset.testid = 'stl-preview-canvas'
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.screenSpacePanning = true

    scene.add(new THREE.HemisphereLight(0xffffff, 0x78818d, 2.2))
    const keyLight = new THREE.DirectionalLight(0xffffff, 3)
    keyLight.position.set(3, 4, 5)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight(0xffd7bd, 1.2)
    fillLight.position.set(-4, -2, 3)
    scene.add(fillLight)

    let mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null = null
    let frameId = 0
    let disposed = false
    let resizeObserver: ResizeObserver | null = null

    const resize = () => {
      const width = Math.max(container.clientWidth, 1)
      const height = Math.max(container.clientHeight, 1)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    const render = () => {
      controls.update()
      renderer.render(scene, camera)
      frameId = window.requestAnimationFrame(render)
    }

    const loader = new STLLoader()
    loader.load(
      url,
      (geometry) => {
        if (disposed) {
          geometry.dispose()
          return
        }

        geometry.computeVertexNormals()
        geometry.center()
        const material = new THREE.MeshStandardMaterial({
          color: 0xe9edf0,
          roughness: 0.68,
          metalness: 0.04,
          side: THREE.DoubleSide,
        })
        mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)

        const bounds = new THREE.Box3().setFromObject(mesh)
        const size = bounds.getSize(new THREE.Vector3())
        const radius = Math.max(size.length() / 2, 0.01)

        const resetView = () => {
          controls.target.set(0, 0, 0)
          const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.15
          camera.position.set(distance * 0.55, distance * 0.42, distance)
          camera.near = Math.max(distance / 1000, 0.001)
          camera.far = distance * 20
          camera.updateProjectionMatrix()
          controls.minDistance = radius * 0.3
          controls.maxDistance = distance * 5
          controls.update()
        }

        resetViewRef.current = resetView
        resetView()
        setLoading(false)
      },
      undefined,
      () => {
        if (!disposed) {
          setLoading(false)
          setError('This STL file could not be previewed. You can still download it.')
        }
      },
    )

    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()
    render()

    return () => {
      disposed = true
      resetViewRef.current = null
      resizeObserver?.disconnect()
      window.cancelAnimationFrame(frameId)
      controls.dispose()
      if (mesh) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [filename, url])

  return (
    <div ref={containerRef} className="relative h-full min-h-[280px] w-full overflow-hidden bg-bg sm:min-h-[480px]">
      {loading && (
        <div role="status" className="absolute inset-0 z-10 grid place-items-center bg-bg text-sm font-medium text-text-muted">
          Loading 3D model…
        </div>
      )}
      {error && (
        <div role="alert" className="absolute inset-0 z-10 grid place-items-center bg-bg p-6 text-center text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}
